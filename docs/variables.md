## tphp 变量 {#tphp-variables}

PHP 变量规则：

- 变量以 $ 符号开始，后面跟着变量的名称
- 变量名必须以字母或者下划线字符开始
- 变量名只能包含字母数字字符和下划线（A-z、0-9 和 _ ）
- 变量名不能包含空格
- 变量名是区分大小写的（$y 和 $Y 是两个不同的变量）

### 类型推导与固定 {#type-inference}

**AOT 类型固定**：变量在首次赋值时确定类型，**后续不可变**。尝试切换类型（如 `$x` 先 `int` 后 `string`）会在 C 编译阶段报错。因此 `===` 与 `==` 等价——编译期已知类型，不存在"同时类型不同"的情况。

```php
class Main
{
    public function main(): void
    {
        // 声明变量，变量类型自动推导
        $name = "John";         // string
        $age = 30;              // int
        $cars = ["Volvo", "BMW"];  // array<mixed>
        $x = 5;                 // int
        $y = 10.0;              // float
        $z = $x + $y;           // float
        $zz = new stdClass();   // stdClass（动态属性容器）
        $fff = function(int $x):int { return $x * $x; };  // callable，闭包必须强类型写法

        // $x = "hello";        // 编译错误：int 不能切换为 string
    }
}
```

### 可选类型标记 {#type-markers}

局部变量和全局/命名空间常量支持前置类型标记（声明与推断不一致时编译期报错）；**类属性和类常量必须写类型**（`public $x` 会被拒绝）：

```php
class Main {
    public function main(): void {
        int $a = 10;                     // 等价于 $a = 10;
        float $b = 10.0;
        string $c = "Hello";
        array<string> $d = ["a", "b", "c"];
        callable $f = function(int $x):int { return $x * $x; };
        Point $p = new Point(1, 2);      // 类类型
        array<int> $nums = [1, 2, 3];    // 泛型数组
    }
}

const int MAX = 100;             // 全局常量可选标记（顶层声明）

class C {
    const int TIMEOUT = 30;      // 类常量类型必填
    public string $name;         // 属性类型必填
}
```

### 常量 {#constants}

- 全局常量：`const int MAX = 100;`（可选类型标记）
- 类常量：`const int TIMEOUT = 30;`（**类型必填**），访问 `self::TIMEOUT` / `C::TIMEOUT`
- 魔术常量：`__LINE__` `__FILE__` `__DIR__` `__CLASS__` `__METHOD__` `__FUNCTION__` `__NAMESPACE__` `DIRECTORY_SEPARATOR`（编译期替换）

### 变量作用域 {#variable-scope}

```php
function myTest() {
    $x = 10;    // 局部变量
    echo $x;
}

class Main {
    public function main(): void {
        myTest();
        $a = 10;
        // 无 global 关键字，闭包用 use 引用外部变量
        $fn = function(int $x) use($a): int {
            return $x + $a;
        };
    }
}
```

**引用传参**（全类型支持 int/float/bool/string/array/对象）：

```php
function increment(int &$x): void {
    $x++;
}
```

### tphp 数组 {#tphp-arrays}

tphp 数组是 `t_array*`（128 槽 LIFO 复用池 + 1.5× 增长 + str/int 键双哈希索引，≥8 键 O(1) 查找），支持**泛型 `array<T>`**：

```php
class Main {
    public function main(): void {
        // 无声明类型数组，默认 array<mixed>
        $arr = [1, "a", true];

        // 声明类型数组 → 紧凑存储，省 67% 内存
        array<int> $arr2 = [1, 2, 3];        // 8B/元素
        array<string> $arr3 = ["a", "b", "c"];  // 24B/元素 (SSO 内联)
        array<Foo> $arr4 = [new Foo(), new Foo()];  // 8B/元素（指针）
    }
}
```

| 元素类型 | C 结构 | value 大小 |
|---------|--------|-----------|
| `int` | `t_arr_int` | 8 字节 |
| `string` | `t_arr_str` | 24 字节（SSO 内联） |
| `float` | `t_arr_float` | 8 字节 |
| `bool` | `t_arr_bool` | 1 字节 |
| `mixed` | `t_arr_var` | 24 字节（tagged union） |
| `array<U>` / `Foo` | `t_arr_ptr` | 8 字节（指针） |

**默认推导规则**：

- 无注解 `$arr = [1, 2, 3]` → `array<mixed>`（保持 PHP 动态语义）
- 显式声明 `array<int> $arr = [1, 2, 3]` → `array<int>`（触发紧凑存储优化）
- 空数组 `$arr = []` → `array<mixed>`；`array<int> $arr = []` → `array<int>`

**类型严格性**：显式声明 `array<T>` 后，push 不同类型触发**编译错误**：

```php
class Main {
    public function main(): void {
        array<int> $arr = [1, 2];
        // $arr[] = "hello";   // 编译错误：Cannot push string to array<int>
    }
}
```

需用 `array<mixed>` 表达异构意图。相关内置函数限制：`array_push/pop/shift/unshift` 与 `asort/ksort/uasort/usort` 对 `array<T>` 拒绝，用 `$arr[] = $v` 或 `sort()` 替代。

**协变转换**：`array<T>` 传给 `array<mixed>` 参数时自动调用 O(n) 转换（如 `tphp_fn_arr_int_to_var`）；同类型直接传递零开销：

```php
function foo(array $arr): void { }        // 参数推导为 array<mixed>

class Main {
    public function main(): void {
        array<int> $nums = [1, 2, 3];
        foo($nums);                        // 自动协变转换，O(n)
    }
}
```

**数组字面量 spread**：`[...$arr1, ...$arr2]`、混合 `[1, ...$arr, 2]`、嵌套 `[[...$a], [...$b]]` 均支持；int 键重新索引（append），string 键保留并覆盖。

### 变量相关不支持项 {#unsupported-vars}

| 特性 | 原因 | 代替方案 |
|------|------|---------|
| `$$var` / `${expr}` | 编译时不知道变量名（无运行时符号表） | `$map[$key]` |
| `$GLOBALS` 超全局 | 无运行时全局符号表 | 显式传参 |
| `compact()` / `extract()` / `get_defined_vars()` | 依赖运行时符号表 | 显式传参 / `use` 闭包 |
| 动态属性 `$obj->x = 1` | 类布局编译期固定 | 预先声明属性 |
