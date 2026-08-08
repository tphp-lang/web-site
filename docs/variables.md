## tphp 变量 {#tphp-variables}

PHP 变量规则：

- 变量以 $ 符号开始，后面跟着变量的名称
- 变量名必须以字母或者下划线字符开始
- 变量名只能包含字母数字字符和下划线（A-z、0-9 和 _ ）
- 变量名不能包含空格
- 变量名是区分大小写的（$y 和 $Y 是两个不同的变量）

### 什么是变量 {#what-is-variable}

变量是存放数据的命名容器。你可以把它想象成一个贴了标签的盒子：盒子里的东西就是变量的"值"，标签上的名字就是变量名。在 tphp 里，变量名以 `$` 符号开头，比如 `$count`、`$name`、`$user_age`——`$` 就像盒子标签上的前缀，告诉编译器"这是一个变量"。给变量赋值就是把东西放进盒子，读取变量就是把盒子里的东西取出来用。

### 变量为什么有类型 {#why-types}

光知道盒子里有东西还不够，编译器还需要知道盒子里装的是整数、文本还是别的——这就是"类型"。类型告诉编译器该用什么方式存储、读取和操作这个值，从而生成高效的原生代码。tphp 是 AOT 编译（提前把 PHP 编译成 C 再编译成机器码），所有类型必须在**编译期**就确定下来，所以每个变量都有一个固定类型。

### tphp 的类型固定意味着什么 {#type-fixing-meaning}

"类型固定"指的是：变量在**首次赋值**时确定类型，之后不能再改成其他类型。比如 `$x = 10` 之后，`$x` 就一直是 `int`，再写 `$x = "hi"` 会在编译阶段报错。这是 tphp 与传统 PHP 最大的区别，也是性能的来源——既然类型在编译期已经定死，编译器就无需在运行时反复检查类型，可以直接生成最优化的机器码。

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

### 静态局部变量 {#static-local}

`static` 关键字声明函数级持久的局部变量，首次进入函数时初始化，之后跨调用保留值。类型与初始值均**可选**：

```php
function counter(): int {
    static $count = 0;        // 类型可选，初始值可选（默认零值）
    static int $limit = 100;  // 带类型标记
    $count++;
    return $count;
}

class Main {
    public function main(): void {
        echo counter();   // 1
        echo counter();   // 2
        echo counter();   // 3
    }
}
```

> `static` 局部变量为函数级持久存储，仅初始化一次。注意：`static` 修饰**类属性**时标志当前会丢失（编译为实例属性），仅 `static` 局部变量与内置类（Thread/Parallel/Enum）支持真静态语义。

### tphp 数组 {#tphp-arrays}

tphp 数组是有序映射，支持 str/int 键 O(1) 查找，支持**泛型 `array<T>`**：

```php
class Main {
    public function main(): void {
        // 无声明类型数组，默认 array<mixed>
        $arr = [1, "a", true];

        // 声明类型数组 → 紧凑存储，省 67% 内存
        array<int> $arr2 = [1, 2, 3];        // 8B/元素
        array<string> $arr3 = ["a", "b", "c"];  // 24B/元素
        array<Foo> $arr4 = [new Foo(), new Foo()];  // 8B/元素（指针）
    }
}
```

| 元素类型 | value 大小 |
|---------|-----------|
| `int` | 8 字节 |
| `string` | 24 字节 |
| `float` | 8 字节 |
| `bool` | 1 字节 |
| `mixed` | 24 字节 |
| `array<U>` / `Foo` | 8 字节（指针） |

**默认推导规则**：

- 无注解 `$arr = [1, 2, 3]` → `array<mixed>`（保持 PHP 动态语义）
- 显式声明 `array<int> $arr = [1, 2, 3]` → `array<int>`（紧凑存储，省 67% 内存）
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

**协变转换**：`array<T>` 传给 `array<mixed>` 参数时自动调用 O(n) 转换；同类型直接传递零开销：

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
