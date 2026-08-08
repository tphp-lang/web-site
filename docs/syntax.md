## 语法特性 {#syntax}

> 基于 PHP 8.5 强类型语法，约 **80%** PHP 兼容性。下列特性均已在 AOT 编译器中实现。<br>
> 脚本标签 `<?php ?>` 可选，无游离代码（文件顶层只能放声明与指令）。<br>
> 注释 `//` `/* */` 支持；`#` 开头是编译指令（`#debug`/`#include`/`#import`/`#if`），不是注释。

### 本语言速览 {#overview}

tphp（TinyPHP）是基于 PHP 8.5 强类型语法的 AOT 编译语言，围绕五大支柱展开：**控制流**（`if`/`switch`/`match`/循环）、**OOP**（类/继承/Trait/Enum/匿名类）、**闭包**（`fn` 箭头函数与 `function` 闭包）、**异常**（`try/catch/finally` + `throw`/`error()`）、**命名空间**（`namespace` + `use` 导入）。下面这段最小示例一次性展示这五大支柱：

```php
namespace App;                          // 命名空间
class Greeter {                         // OOP
    public function __construct(public string $name) {}
    public function say(): void {       // 控制流 + 异常
        if ($this->name === "") { error("empty"); }
        echo "hi " . $this->name;
    }
}
$g = fn(Greeter $g): void => $g->say(); // 闭包
```

下面各小节是语法速查参考；控制流、函数、OOP、异常的**完整教程**（含示例与限制说明）已拆分为独立专题页，请配合阅读：[控制流](docs/control-flow.md)、[函数与闭包](docs/functions.md)、[面向对象](docs/oop.md)、[异常与错误](docs/exceptions.md)。

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

| 类型 | 说明 |
|------|------|
| `int` | 64 位有符号整数 |
| `float` | IEEE 754 双精度 |
| `string` | 字符串 |
| `bool` | true/false |
| `array` | 有序映射，int/string 键 |
| `array<T>` | 泛型数组，元素类型固定 |
| `callable` | 闭包 |
| `mixed` | 可变类型，有运行时开销 |
| `void` / `never` | 无返回值 / 永不返回 |
| 类类型 | 对象引用 |

**`array<T>` 泛型**：`array<int>` 比 `array<mixed>` **省 67% 内存**。无注解 `$arr = [1,2,3]` 默认推导 `array<mixed>`；显式声明后 push 不同类型报编译错误；传给 `array<mixed>` 参数会自动转换。

### 完全兼容特性 {#supported}

| 类别 | 特性 |
|------|------|
| 控制流 | `if/elseif/else`、`while`、`do-while`、`for`、`foreach`、`switch`（含字符串 switch、fall-through）、`match`、`break N`、`continue N`、`goto` |
| OOP | `class`、`extends`、`interface`、`implements`、`trait+use`、`abstract class`、`final class`、`readonly`、`enum`（int/string backing）、`__construct(public $x)` 属性提升、`__destruct`、`instanceof`、`self::`/`parent::`、链式调用、`?->` |
| Property Hook | `public string $x { get => ...; set => ...; }`（PHP 8.4） |
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

### 匿名类 {#anon-class}

`new class [(args)] [extends Parent] [implements Iface] { members }` 声明匿名类，与普通类行为完全等价；不支持 `use()` 捕获语法与通过接口类型变量分派。完整语法与限制详见 [面向对象 · 匿名类](docs/oop.md#anon-class)。

### Trait 与冲突解决 {#trait}

Trait 引入到使用类后与类自身成员等价，无额外运行时开销；多 trait 同名方法必须用 `insteadof` / `as` 显式解决冲突，否则编译报错；类自身成员优先于 trait 成员。冲突解决规则、可见性改写与不支持项详见 [面向对象 · Trait](docs/oop.md#trait)。

### 控制流与异常 {#control-flow}

tphp 支持完整控制流（`if/elseif/else`、`while/do-while/for/foreach`、`switch`（含 fall-through）、`match`、`break/continue N`、`goto`）与异常机制（`try/catch/finally`、`throw`、`error()` 简写）。函数体含 `throw`/`error()` 时须在返回类型声明 `|Exception`（TinyPHP 扩展，纯文档提示）；普通联合类型 `int|string` 不支持。完整教程见 [控制流](docs/control-flow.md) 与 [异常与错误](docs/exceptions.md)。

### 闭包与 Generator {#closure-generator}

闭包支持 `function() use($x) {}`、单表达式 `fn($x): T => expr` 与块体 `fn($x): T => { stmts }`（须以 `return` 结尾）；Generator 支持 `yield $k => $v`、`send()` 双向传值、`getReturn()`，不使用 `yield` 时零开销。完整教程见 [函数与闭包](docs/functions.md)。

### 函数与可变参数 {#variadic}

默认值参数（`int $x = 10`）须置于参数列表末尾；可变参数 `...$args` 在函数内作为数组使用，`f(...$arr)` 透传无需额外拷贝。`func_get_args()` 仅可在变参函数内使用。完整教程见 [函数与闭包](docs/functions.md)。

### TinyPHP 独有特性 {#unique}

| 语法 | 说明 |
|------|------|
| `defer EXPR;` / `defer { ... }` | Zig 风格作用域清理：作用域结束时 LIFO 执行 |
| `#if / #elseif / #else / #endif` | 条件编译：解析期求值，非命中分支跳过。条件支持 `Windows`/`Linux`/`Darwin`/`Android`/`TCC`/`GCC`/`Clang`/`x86_64`/`aarch64`/`debug`/`prod` 标识符 + `!`/`&&`/`\|\|` |
| 注解系统 | `#[Attribute(path: string)] const ROUTE = [];` 声明 + `#[ROUTE("/x")]` 使用，`ROUTE[0]->call()/newInstance()` 调用目标 |
| `Type\|Exception` 返回类型 | 见「控制流与异常」 |
| `error($msg)` | `throw new Exception($msg)` 简写 |
| 块体箭头函数 | `fn(): T => { stmts }`（PHP 原生仅单表达式） |
| `#cstruct Name { C.type field; }` | 声明 C 结构体字段布局，`$p->field` 原生访问 |
| `#callback` / `#include` / `#flag` / `#import` | 见 [C 互操作 PHPC](docs/phpc.md) 与 [扩展系统](docs/extensions.md) |
| C 指针泄漏编译期提醒 | transfer 指针未 `defer`/`free` 时输出 `[WARN]`（不阻断编译） |

### 注解系统 {#annotations}

注解明确**不支持运行时反射**，仅支持**位置参数**（与全局命名参数禁用一致）。

**声明**（附着于全局/命名空间 `const`，必须为空数组 `[]`）+ **使用**（附着于 class/method/function，可连续多个 `#[...]`）：

```php
#[Attribute(path: string)]
const ROUTE = [];

class Main {
    #[ROUTE("/test")]
    public function test(): void { echo "test\n"; }

    public function main(): void {
        var_dump(ROUTE[0]->name);    // "Main->test"
        var_dump(ROUTE[0]->type);    // "method"
        var_dump(ROUTE[0]->data);    // ["/test"]
        ROUTE[0]->call();            // 调用目标方法
        $demo = ROUTE[1]->newInstance("x");  // 实例化目标类
    }
}

#[ROUTE("/Demo")]
class Demo {
    public function __construct(string $name) {}
}
```

每个注解使用提供一个可访问的实例：

| 属性 / 方法 | 类型 / 签名 | 说明 |
|------------|------------|------|
| `$data` | `array` | 位置参数数组 |
| `$type` | `string` | 目标类型：`method` / `static_method` / `class` / `function` |
| `$name` | `string` | 限定名：`Ns\Class->method` / `Ns\Class::staticMethod` / `Ns\func` / `Ns\Class` |
| `call(...$args): T` | 方法 | 调用目标方法/静态方法/函数（class 目标报错） |
| `newInstance(...$args): ClassType` | 方法 | 实例化目标类（非 class 目标报错） |

> **索引规则**：静态索引 `ROUTE[N]` 的 N 必须为编译期整数常量且在有效范围内；`foreach` 变量 `$v` 用于遍历所有注解。**跨命名空间匹配**与普通常量作用域一致：短名匹配（同命名空间 + 全局回退），`use const` 导入或 FQ 名（含 `\`）精确匹配。
>
> **校验**：参数数量须在声明参数 `[required, total]` 范围内（支持默认值）；命名参数 `#[ROUTE(path: "/x")]` 报语法错误，应用 `#[ROUTE("/x")]`；注解不继承父类，仅作用于 class/method/function（不支持属性/参数）。

### tphp 不支持 {#unsupported}

（AOT 不可行）

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
| `func_get_args()`（定参函数） | 定参函数参数已固定 | 可变参数 `...$args`（该场景下已支持） |
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
