## 语法特性 {#syntax}

> 基于 PHP 8.5 强类型语法，约 **80%** PHP 兼容性。下列特性均已在 AOT 编译器中实现。<br>
> 脚本标签 `<?php ?>` 可选，无游离代码（文件顶层只能放声明与指令）。<br>
> 注释 `//` `/* */` 支持；`#` 开头是编译指令（`#debug`/`#include`/`#import`/`#if`），不是注释。

### 基本语法 {#basic-syntax}

php 文件默认拓展名是 `.php`，不能含有 HTML 标签和游离代码。每个程序需要一个 **`Main` 类**与 `main()` 入口方法：

```php
<?php // <?php 标签可选

class Main
{
    // 构造函数 — 接收命令行参数（可选，默认可省略）
    public function __construct(int $argc, array $argv) {}

    // 入口函数 — 必须为 public function main(): void
    public function main(): void
    {
        echo "hello world\n";
    }

    // 析构函数 — 程序退出前自动调用（可选）
    public function __destruct() {}
}
```

### 类型系统 {#type-system}

**类型固定**：变量在首次赋值时确定类型，后续不可变，切换类型会在 C 编译阶段报错。因此 `===` 与 `==` **等价**——编译期已知类型，"同时类型不同"不存在。

**可选类型标记**：局部变量和全局常量支持前置类型标记（声明与推断不一致时编译期报错）；**类属性与类常量必须写类型**：

```php
class Main {
    public function main(): void {
        int $x = 42;                      // 等价于 $x = 42;
        string $s = "hello";
        array<int> $nums = [1, 2, 3];     // 泛型数组
        array<array<int>> $grid = [[1, 2], [3, 4]];
    }
}

const int MAX = 100;              // 全局常量可选标记（顶层声明）

class C {
    const int TIMEOUT = 30;       // 类常量类型必填
    public string $name;          // 属性类型必填（public $name 会被拒绝）
}
```

| PHP 类型 | C 类型 | 说明 |
|----------|--------|------|
| `int` | `int64_t` | 64 位有符号整数 |
| `float` | `double` | IEEE 754 双精度 |
| `string` | `t_string` | SSO ≤23 字节内联，超限走池 |
| `bool` | `bool` | true/false |
| `array` | `t_array*` | 有序映射，int/string 键 |
| `array<T>` | `t_array*` | 泛型数组，元素类型编译期已知 |
| `callable` | `t_callback` | 闭包/C 函数指针 |
| `mixed` | `t_var` | 标签联合体，有运行时开销 |
| `void` / `never` | `void` | 无返回值 / 永不返回 |
| 类类型 | `tphp_class_X*` | COS 对象指针 |

**`array<T>` 泛型**：六种单态化存储（int 8B / string 24B / float 8B / bool 1B / mixed 24B / ptr 8B），`array<int>` 比 `array<mixed>` **省 67% 内存**。无注解 `$arr = [1,2,3]` 默认推导 `array<mixed>`；显式声明后 push 不同类型报编译错误；传给 `array<mixed>` 参数自动 O(n) 协变转换。

### 完全兼容特性 {#supported}

| 类别 | 特性 |
|------|------|
| 控制流 | `if/elseif/else`、`while`、`do-while`、`for`、`foreach`、`switch`（含字符串 switch、fall-through）、`match`、`break N`、`continue N`、`goto` |
| OOP | `class`、`extends`、`interface`、`implements`、`trait+use`、`abstract class`、`final class`、`readonly`、`enum`（int/string backing）、`__construct(public $x)` 属性提升、`__destruct`、`instanceof`、`self::`/`parent::`、链式调用、`?->` |
| Property Hook | `public string $x { get => ...; set => ...; }`（PHP 8.4，编译为 getter/setter） |
| 闭包 | `function() use($x) {}`、`fn($x): T => expr`、`fn($x): T => { stmts }`（块体）、嵌套闭包、多捕获 |
| 异常 | `try/catch(Exception $e)/finally`、`throw new Exception()`、`throw` 表达式、`error($msg)` |
| 运算符 | 完整 15 级优先级：算术/比较/逻辑/位/三元 `?:`/空合并 `??`/太空船 `<=>`/自增自减/类型转换/管道 `\|>` |
| 命名空间 | `namespace A\B`、`use A\{B,C}` 分组导入、`use function`/`use const` 组合导入、混合导入 |
| 语法糖 | `list()/$a[] =` 解构、`$a[] =` push、`[...$arr1, ...$arr2]` spread、`int &$x` 引用传参、`int $x = 10` 默认值参数、字符串插值、heredoc/nowdoc、魔术常量 |
| 字面量 | `0x1F` `0b1010` `0o777` `1_000_000`、`1e10` `3_14.15_92`、函数调用尾逗号 |

### OOP 限制（重要） {#oop-limits}

| 语法 | 状态 | 说明 |
|------|------|------|
| `protected` | ❌ **不做** | 仅支持 `public` / `private` |
| `static` 属性 | ⚠️ 部分支持 | 语法接受 `public static int $x = 0;` 但 static 标志当前会**丢失**（编译为实例属性）；仅内置类（Thread/Parallel/Enum）真静态 |
| `final` 方法 | ❌ 不支持 | `final` 仅支持类级别；写 `final public function` 报语法错误 |
| `abstract` 方法 | ⚠️ 部分支持 | 语法接受但不强制子类实现（无编译/运行期检查） |
| `readonly` | ✅ 已实现 | 支持单属性与 `readonly class`（全部属性自动 readonly）；仅可在本类 `__construct` 赋值一次；不支持默认值；不支持 `static readonly` |

### 控制流与异常 {#control-flow}

```php
function divide(int $a, int $b): int|Exception {   // 含 throw 必须声明 |Exception
    if ($b === 0) {
        throw new Exception("div by zero");
    }
    return intdiv($a, $b);
}

class Main {
    public function main(): void {
        switch ($cmd) {          // 支持 fall-through
            case "start": echo "run"; break;
            case "stop": echo "halt"; break;
        }
        $r = match ($x) { 1 => "one", 2 => "two", default => "?" };
        error("直接抛出可捕获异常");   // 等价 throw new Exception($msg)
    }
}
```

> `Type\|Exception` 是 TinyPHP 扩展语法：函数体含 `throw`/`error()` 时**必须**在返回类型声明 `\|Exception`（纯文档提示，C 仅生成 `\|` 前类型，零开销）。普通联合类型（`int|string`）映射 `t_var`，不支持。

### 闭包与 Generator {#closure-generator}

```php
function gen(): Generator {                  // 顶层函数声明（minicoro stackless 协程）
    yield 1;
    yield "k" => "v";
    return 42;
}

class Main {
    public function main(): void {
        $fn = fn(int $x): int => $x * 2;             // 单表达式
        $blk = fn(int $x): int => { $y = $x + 1; return $y; };  // 块体（须以 return 结尾）
        foreach (gen() as $v) { var_dump($v); }
    }
}
```

Generator 支持 `yield $k => $v`、`send()` 双向传值、`getReturn()`、`foreach` 迭代；不使用 `yield` 时零开销。

### TinyPHP 独有特性 {#unique}

| 语法 | 说明 |
|------|------|
| `defer EXPR;` / `defer { ... }` | Zig 风格作用域清理：编译期展开到所有 return/fall-through 路径，LIFO 执行，**零运行时开销** |
| `#if / #elseif / #else / #endif` | 条件编译：解析期求值，非命中分支跳过。条件支持 `Windows`/`Linux`/`Darwin`/`Android`/`TCC`/`GCC`/`Clang`/`x86_64`/`aarch64`/`debug`/`prod` 标识符 + `!`/`&&`/`\|\|` |
| 注解系统 | `#[Attribute(path: string)] const ROUTE = [];` 声明 + `#[ROUTE("/x")]` 使用，`ROUTE[0]->call()/newInstance()` 编译期展开为零开销直接调用 |
| `Type\|Exception` 返回类型 | 见「控制流与异常」 |
| `error($msg)` | `throw new Exception($msg)` 简写 |
| 块体箭头函数 | `fn(): T => { stmts }`（PHP 原生仅单表达式） |
| `#cstruct Name { C.type field; }` | 声明 C 结构体字段布局，`$p->field` 原生访问 |
| `#callback` / `#include` / `#flag` / `#import` | 见 [C 互操作 PHPC](phpc.md) 与 [扩展系统](extensions.md) |
| C 指针泄漏编译期提醒 | transfer 指针未 `defer`/`free` 时输出 `[WARN]`（不阻断编译） |

注解系统示例：

```php
#[Attribute(path: string)]
const ROUTE = [];

class Main {
    #[ROUTE("/test")]
    public function test(): void { echo "test\n"; }

    public function main(): void {
        var_dump(ROUTE[0]->name);    // "Main->test"
        var_dump(ROUTE[0]->data);    // ["/test"]
        ROUTE[0]->call();            // 编译期展开为直接调用，零开销
    }
}
```

### tphp 不支持 {#unsupported}

（AOT 物理不可行）

| 特性 | 原因 | 代替方案 |
| ---- | ---- | ---- |
| `eval()` | 没有运行时解释器 | `switch`/`match` 分支调度，或回调分发 |
| `$$var` 可变变量 | 编译时不知道变量名 | `array` 映射：`$map[$key]` 替代 `$$key` |
| `include/require` | 没有运行时文件加载 | `#include` 引入 C 头文件，或多文件编译 |
| `$fn()` / `$obj->$m()` / `call_user_func()` | 编译时不知道函数名 | 回调 map：`$fn = $map[$name]; $fn($args);` |
| `__call` `__get` `__set` `__callStatic` | 没有运行时分发 | 显式定义方法，或用 `switch` 分发 |
| `__toString` `__invoke` `__clone` 等魔术方法 | 需运行时动态分发/序列化 | 显式方法或 `->data` 访问 |
| 动态属性 `$obj->x = 1` | 类布局编译期固定 | 预先声明属性 |
| `Reflection*` 全系列 | 运行时内省 | 注解系统（编译期消费） |
| `$GLOBALS` / `compact()` / `extract()` / `get_defined_vars()` | 无运行时符号表 | 显式传参 / `use` 闭包 |
| `func_get_args()`（定参函数） | 参数固化为 C 形参 | 可变参数 `...$args`（该场景下已支持） |
| `ArrayAccess` / `Iterator` / `Stringable` 接口语义 | 需运行时动态分发 | `implements` 仅记录，不生效 |
| `debug_backtrace()` | 运行时栈帧 | — |

（不做 — 权衡决定）

| 特性 | 原因 | 代替方案 |
| ---- | ---- | ---- |
| `?int` 可空类型 / `int\|string` 联合 | 破坏类型固定优势 | `mixed` 替代，或拆分为重载函数 |
| `protected` 可见性 | 设计取舍 | 仅 `public`/`private` |
| 命名参数 | AOT 无意义 | 位置参数 |
| `clone` 关键字 | 需 `__clone` 动态分发 | 显式构造新对象 |
| `??=` 空合并赋值 | 未实现 | `$a = $a ?? $b;` |
| `declare(strict_types=1)` | 本身即强类型 | — |
| first-class callable `strlen(...)` | AOT 下函数编译期已知 | 闭包或直接调用 |
