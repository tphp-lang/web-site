## 特性与功能总览 {#features}

tphp 把类 PHP 语法 AOT 编译成原生二进制——没有 Zend VM、没有 OPCache、不需要 PHP 环境。源码经编译器生成类型安全的 C，再编译为原生二进制（可执行文件或动态库）。下表是全部特性能力矩阵，便于快速通览 tphp 能做什么；每项随后均有独立小节给出最小示例与 PHP 差异。

### 特性矩阵表 {#matrix}

| 特性 | 状态 | 一句话说明 |
|------|------|-----------|
| 类型系统 | ✅ | 类型固定（首次赋值确定）+ 可选类型标记 + `array<T>` 泛型数组，`===` 与 `==` 等价 |
| 面向对象 | ✅ | 继承/接口/trait/enum/匿名类/属性提升/Property Hook/readonly，继承零运行时开销 |
| 闭包与箭头函数 | ✅ | `function() use($x) {}`、`fn() => expr`、`fn() => { stmts }` 块体扩展，多捕获与嵌套 |
| Generator | ✅ | `yield`/`yield from`/`send()`/`getReturn()`，不用 yield 零开销 |
| 控制流全集 | ✅ | `if/while/do-while/for/foreach/switch`（含字符串 switch、fall-through）/`match`/`break N`/`continue N`/`goto` |
| 异常与 Type\|Exception | ✅ | `try/catch/finally` + `throw` 表达式 + `error()` 简写；`int\|Exception` 扩展返回类型纯文档提示 |
| PHPC C 互操作 | ✅ | `C->func()`/`C->CONST`/`C.Type`/`c_*`/`php_*`/`phpc_*` 双向桥接，`#include`/`#flag`/`#cstruct`/`#callback` |
| 多线程 | ✅ | `Thread`/`Mutex`/`CondVar`/`WaitGroup` + `Channel`/`Future`/`chan_select` + `Parallel::for/map`，Thread-Local 运行时无锁竞争 |
| 注解系统 | ✅ | `#[Attribute]` 声明 + `#[NAME(args)]` 使用，`ROUTE[0]->call()/newInstance()` 编译期展开为零开销直接调用 |
| 命名空间 | ✅ | `namespace A\B`、`use A\{B,C}` 分组、`use function`/`use const` 组合导入、混合导入 |
| defer | ✅ | Zig 风格作用域清理，函数退出时按 LIFO 执行，零运行时开销 |
| 底层优化 | ✅ | 编译器自动优化，用户无需关心 |

### 类型系统 {#type-system}

一句话说明：变量类型在首次赋值时固定、之后不可变，配合可选类型标记与 `array<T>` 泛型数组，让编译期已知类型、消除运行时类型检查。

```php
class Main {
    public function main(): void {
        int $x = 42;                       // 可选类型标记，等价 $x = 42;
        string $s = "hello";
        array<int> $nums = [1, 2, 3];      // 泛型数组：紧凑存储，元素类型编译期已知
        array<array<int>> $grid = [[1, 2], [3, 4]];

        $nums[] = "ok";                    // 编译错误：Cannot push string to array<int>
        if ($x === 42) { }                 // === 与 == 等价（类型固定）
    }
}

const int MAX = 100;                       // 全局常量类型可选
class C {
    const int TIMEOUT = 30;                // 类常量类型必填
    public string $name;                   // 属性类型必填（public $name 会被拒绝）
}
```

与 PHP 差异：PHP 变量可随时切换类型，`===` 需额外做类型比对；tphp 切换类型在编译阶段报错，`===` 直接降级为 `==`，零运行时类型检查。`array<T>` 比 `array<mixed>` 节省最多 67% 内存，传给 `array<mixed>` 参数时自动 O(n) 协变转换。不支持 `?int` 可空与普通联合类型 `int|string`（后者退化为 `mixed`，有运行时开销）。

### 面向对象 {#oop}

一句话说明：完整的 OOP 体系——继承/接口/trait/enum/匿名类/构造器属性提升/Property Hook/readonly，零运行时开销。

```php
interface Shape { public function area(): float; }

trait Printable { public function describe(): void { echo "shape\n"; } }

enum Color: string { case Red = "r"; case Green = "g"; }

class Point {
    public function __construct(public float $x, public float $y) {}  // 属性提升
}

class Circle extends Point implements Shape {
    use Printable;
    public function __construct(public float $r) { parent::__construct(0, 0); }
    public function area(): float { return 3.14 * $this->r * $this->r; }
}

class Config {
    public string $name {                                                 // Property Hook (PHP 8.4)
        get => strtoupper($this->name);
        set => strtolower($value);
    }
    public function __construct(public readonly int $id) {}               // readonly 属性提升
}
```

与 PHP 差异：trait 与匿名类编译期处理，零运行时开销；`readonly` 为编译期静态检查、无运行时开销；Property Hook 编译为 getter/setter 方法。限制：仅支持 `public`/`private`（无 `protected`）；`final` 仅类级别（`final` 方法报语法错误）；`static` 属性语法接受但标志会丢失（仅内置类真静态）；`abstract` 方法语法接受但不强制子类实现；通过接口类型变量调用方法不支持。

### 闭包与箭头函数 {#closures}

一句话说明：支持全部闭包形态，并扩展了块体箭头函数 `fn(): T => { stmts }`，可在箭头函数中编写多条语句。

```php
class Main {
    public function main(): void {
        $add = function(int $a, int $b): int { return $a + $b; };        // 闭包
        $inc = fn(int $x): int => $x + 1;                                // 单表达式箭头函数
        $blk = fn(int $x): int => {                                      // 块体箭头函数（TinyPHP 扩展）
            $y = $x + 1;
            return $y * 2;
        };

        $base = 10;
        $addBase = function(int $x) use ($base): int { return $x + $base; };  // use 捕获
        echo $addBase(5);   // 15
    }
}
```

与 PHP 差异：PHP 原生 `fn() =>` 仅支持单表达式；tphp 额外支持 `fn(): T => { stmts }` 块体形式（须以 `return` 结尾，`void` 类型除外）。闭包作用域编译期通过 `use` 固定，因此**不支持** `Closure::bind`/`bindTo`/`call`/`fromCallable`（无法运行时重绑定）。first-class callable `strlen(...)` 不做（AOT 下函数编译期已知，闭包或直接调用即可）。

### Generator {#generator}

一句话说明：支持 `yield`/`yield from`/`send()`/`getReturn()`/`foreach`，不使用 `yield` 的函数零开销。

```php
function counter(int $n): Generator {
    for ($i = 0; $i < $n; $i++) {
        yield $i;                         // yield value
    }
    yield "k" => "v";                     // yield key => value
    return 42;                            // 配合 getReturn()
}

class Main {
    public function main(): void {
        foreach (counter(3) as $k => $v) {
            var_dump($k, $v);
        }

        $gen = counter(2);
        $gen->send(99);                   // 双向传值
        var_dump($gen->getReturn());      // 42
    }
}
```

与 PHP 差异：tphp 的 Generator 不使用 `yield` 时编译为普通函数、零开销。`callable` 参数传字符串函数名不可行（AOT 无法将运行时字符串解析为函数符号），须用闭包 `fn($x) => apply($x)`。macOS + TCC 下 Generator 性能略低。

### 异常与 Type|Exception {#exceptions}

一句话说明：`try/catch/finally` + `throw` 表达式 + `error()` 简写；扩展 `Type|Exception` 返回类型在含 `throw`/`error()` 时必须声明，纯文档提示、零开销。

```php
function divide(int $a, int $b): int|Exception {   // 含 throw 必须声明 |Exception
    if ($b === 0) {
        throw new Exception("div by zero");
    }
    return intdiv($a, $b);
}

function load(int $id): string|RuntimeException {   // |子类 亦可
    if ($id < 0) {
        error("invalid id: $id");                   // 等价 throw new Exception($msg)
    }
    return "item-$id";
}

class Main {
    public function main(): void {
        try {
            divide(10, 0);
        } catch (Exception $e) {
            echo $e->getMessage();                  // div by zero
        } finally {
            echo "done\n";
        }
    }
}
```

与 PHP 差异：`Type|Exception` 是 TinyPHP 独有扩展——`|Exception` 部分仅作文档提示，编译器检查 `|` 后确实是 Exception 子类。`error($msg)` 等价于 `throw new Exception($msg)`。`catch (\Throwable $e)` 不支持，用 `catch (Exception $e)` 兜底；无类型 `catch ($e)` 捕获字符串消息。普通联合类型 `int|string` 退化为 `mixed`，不支持。

### PHPC C 互操作 {#phpc}

一句话说明：完整的 PHP ↔ C 双向互操作——`C->func()` 直接调 C 函数、`C->CONST` 访问常量/宏、`C.Type` 类型注解、`c_int`/`c_str`/`php_int`/`php_str` 类型桥接、`phpc_*` 数组/对象/回调互操作。

```php
#include "include/demo.h"                         // 嵌入 C 头文件

// C.Point* 返回类型 → Point*
function create_origin(): C.Point* {
    return C->point_origin();
}

// C.Point* 参数 + C.double 返回 → Point* / double
function get_point_x(C.Point* $p): C.double {
    return C->point_get_x($p);
}

class Main {
    public function main(): void {
        var_dump(C->COLOR_RED);                   // C 枚举值 → int(0)
        var_dump(C->MAX_SIZE);                    // C #define 宏 → int(1024)

        C.void* $buf = C->malloc(1024);           // transfer 指针
        defer C->free($buf);                      // 编译期展开释放，零开销
    }
}
```

与 PHP 差异：PHP 通过 FFI 扩展访问 C，运行时动态绑定；tphp 在编译期直接生成原生 C 调用，零跨层开销。`#include`/`#flag`/`#cstruct`/`#callback`/`#import` 为预处理指令，受 shell 元字符阻断、flag 前缀白名单、realpath 边界校验等安全模型约束（防注入）。所有权分三类：`phpc_arr_int/dbl` 自动注册无需管，`phpc_arr_str` 需 `defer phpc_free_str_arr`，C 库返回的 `T*` 需 `defer C->free`。详见 [C 互操作 PHPC](docs/phpc.md)。

### 多线程 {#concurrency}

一句话说明：原生多线程 + 异步通信——`Thread`/`Mutex`/`CondVar`/`WaitGroup` 线程原语 + `Channel`/`Future`/`chan_select` CSP 异步原语 + `Parallel::for/map` 数据并行，Thread-Local 运行时无锁竞争。

```php
class Main {
    public function main(): void {
        // Thread + join
        $t = new Thread(function(): int { return 42; });
        $t->start();
        echo $t->join();                          // 42

        // WaitGroup 跨线程同步
        $wg = new WaitGroup();
        $wg->add(1);
        $t2 = new Thread(function() use ($wg): int {
            $wg->done();
            return 0;
        });
        $t2->start();
        $wg->wait();
        $t2->join();

        // Channel 跨线程通信（CSP 风格）
        $ch = new Channel(4);
        $t3 = new Thread(function() use ($ch): int {
            $ch->push(42);
            $ch->close();
            return 0;
        });
        $t3->start();
        echo $ch->pop();                          // 42
        $t3->join();

        // Future 链式回调
        $f = Future::create();
        $f->resolve(10);
        $doubled = $f->then(fn(mixed $x): mixed => $x * 2);
        echo $doubled->await();                   // 20
    }
}
```

与 PHP 差异：PHP 仅 pthreads/parallel 扩展在 ZTS 构建下支持多线程，受 Zend 运行时锁与引用计数制约；tphp 编译为原生 OS 线程，每线程独立运行时，无锁竞争、无 GC 全局停顿。`close` 后 `push` 抛 `ChannelClosedException`，`await` reject 抛 `FutureRejectedException`。`Parallel::for/map` 做连续分片数据并行，线程失败自动降级为内联执行。详见[多线程与异步](docs/threads.md)。

### 注解系统 {#annotations}

一句话说明：纯编译期消费的注解——`#[Attribute]` 声明 + `#[NAME(args)]` 使用，`ROUTE[0]->call()/newInstance()` 编译期展开为零开销直接调用，明确不支持运行时反射。

```php
#[Attribute(path: string)]                      // 声明注解类型（附着于 const，必须空数组）
const ROUTE = [];

class Main {
    #[ROUTE("/test")]                            // 使用注解（仅位置参数）
    public function test(): void { echo "test\n"; }

    public function main(): void {
        var_dump(ROUTE[0]->name);                // "Main->test"
        var_dump(ROUTE[0]->type);                // "method"
        var_dump(ROUTE[0]->data);                // ["/test"]
        ROUTE[0]->call();                        // 编译期展开为直接调用，零开销
    }
}

#[ROUTE("/Demo")]
class Demo {
    public function __construct(string $name) {}
}
```

与 PHP 差异：PHP 注解通过 `ReflectionAttribute` 运行时反射消费，有元数据体积与查找开销；tphp 注解编译期处理，静态索引 `ROUTE[N]` 展开为零开销直接调用。仅支持位置参数（`#[ROUTE(path: "/x")]` 命名参数报语法错误），与全局命名参数禁用一致；注解不继承父类，仅作用于 class/method/function（不支持属性/参数）；`#[Export("name")]` 是独立的动态库导出注解，不经 `#[Attribute]` 声明。

### 命名空间 {#namespace}

一句话说明：完整支持 `namespace`、分组 `use`、`use function`/`use const` 组合导入与混合导入。

```php
namespace MyApp\Models;

use MyApp\{User, Order};                         // 分组类导入
use function MyApp\Utils\{format, parse};        // 组合式函数导入
use const MyApp\{MAX_RETRY, TIMEOUT};            // 组合式常量导入
use MyApp\Service\{Cache, function get, const VERSION};  // 混合导入

class Repository {
    public function find(int $id): User {
        return new User($id);
    }
}
```

与 PHP 差异：语义与 PHP 一致（短名匹配 + 全局回退，`use const` 导入或 FQ 名精确匹配）。`__NAMESPACE__` 魔术常量编译期替换。入口 `Main` 类必须在全局命名空间（无 `namespace` 声明）。

### defer {#defer}

一句话说明：Zig 风格作用域清理，注册清理代码在函数退出时按 LIFO 执行，零运行时开销。

```php
function read_file(string $path): string {
    C.FILE* $fp = C->fopen(c_str($path), c_str("r"));
    if ($fp == null) {
        error("open failed: $path");             // return 路径也执行 defer
    }
    defer C->fclose($fp);                        // 函数退出自动关闭

    C.char* $buf = C->malloc(4096);
    defer C->free($buf);                         // LIFO：先 free(buf) 再 fclose(fp)

    // ... 读取逻辑 ...
    return $content;                             // return 前先执行 defer 清理
}
```

与 PHP 差异：PHP 无 defer 语句，靠 `try/finally` 手动清理；tphp defer 为函数级（PHP 无块作用域），函数退出时按 LIFO 执行。限制：异常路径**不执行** defer，如需异常路径清理请在 `finally` 块中手动处理。典型用途：C 指针释放（`defer C->free($buf)`）、资源关闭（`defer C->fclose($fp)`）、调试输出（`defer echo "exit\n"`）。

### 编译期优化 {#optimization}

tphp 编译器在底层做了多项自动优化（短字符串、拼接、数组存储等），用户无需关心，默认即享性能。在 GCC/Clang -O2 下性能可达 PHP 的 18-36x（数组遍历/读取）。追求极致性能用 `tphp -cc gcc`。

> 完整编译流水线详见[编译流水线](docs/pipeline.md)。
