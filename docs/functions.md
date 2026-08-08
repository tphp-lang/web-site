## 函数与闭包 {#functions}

> 阅读本文前，建议先读 [intro](docs/intro.md)、[basics](docs/basics.md)、[控制流](docs/syntax.md#control-flow)。

### 函数声明 {#decl}

用 `function` 关键字声明顶层函数或类方法。**tphp 函数参数类型必须显式声明**，返回类型可省略（默认 `void`）。

```php
// 顶层函数：参数类型必填，返回类型可省略
function add(int $a, int $b): int {
    return $a + $b;
}

// 多类型参数 + 类类型返回
function greet(string $name, bool $loud = false): string {
    return $loud ? strtoupper($name) . "!" : $name;
}

class Point {
    public float $x;
    public float $y;
    public function __construct(float $x, float $y) {   // 方法参数同样必填类型
        $this->x = $x;
        $this->y = $y;
    }
}

function make_point(float $x, float $y): Point {         // 类类型作返回值
    return new Point($x, $y);
}
```

> 类方法语法见 [OOP](docs/syntax.md#supported)；构造器支持属性提升 `public function __construct(public int $x)`，属性类型同样必填。
> 含 `throw`/`error()` 的函数须声明 `|Exception` 返回类型（见 [控制流与异常](docs/syntax.md#control-flow)）。

### 参数形态 {#params}

tphp 支持三种参数形态：默认值、引用传参、可变参数。三种形态可以组合，但**默认值参数必须放在参数列表末尾**，**可变参数必须是最后一个形参**。

#### 默认值参数

`int $x = 10` 形态。带默认值的参数必须排在无默认值参数之后。默认值支持任意常量表达式（`1 + 2`、`"a" . "b"`、`0xFF | 0x10`），支持 `int`/`float`/`string`/`bool`/`array`，**不支持** `callable` 默认值。

```php
function power(int $base, int $exp = 2): int {           // $exp 默认 2
    $r = 1;
    for ($i = 0; $i < $exp; $i++) $r *= $base;
    return $r;
}

echo power(3);       // 9   （使用默认 exp=2）
echo power(3, 4);    // 81  （覆盖默认值）

// 默认值支持常量表达式
function repeat_str(string $s, int $n = 1 + 2): string {  // n 默认 3
    string $out = "";
    for ($i = 0; $i < $n; $i++) $out .= $s;
    return $out;
}
```

#### 引用传参

`int &$x` 形态。参数前加 `&` 表示按引用传递，函数内对形参的修改会反映到调用方变量。**全类型支持**：`int`/`float`/`bool`/`string`/`array`/对象均可引用传参。

```php
function increment(int &$n): void {                      // 整型引用
    $n++;
}

function append_to(array &$arr, int $v): void {          // 数组引用
    $arr[] = $v;
}

class Counter {
    public int $count;
    public function __construct() { $this->count = 0; }
}

function bump(Counter &$c): void {                       // 对象引用
    $c->count++;
}

// 使用
int $x = 10;
increment($x);
echo $x;            // 11

array $list = [1, 2];
append_to($list, 3);
var_dump($list);    // [1, 2, 3]
```

#### 可变参数

`int ...$nums` 形态。可变形参 `$nums` 在函数内作为数组使用。类型化可变参数 `int ...$nums` 的 `$nums` 推导为 `array<int>`；无类型 `...$args` 推导为 `array<mixed>`。

```php
function sum(int ...$nums): int {                        // $nums 为 array<int>
    int $total = 0;
    foreach ($nums as $n) $total += $n;
    return $total;
}

function log_all(...$args): void {                       // $args 为 array<mixed>
    foreach ($args as $a) var_dump($a);
}

sum(1, 2, 3);          // 多个实参打包为数组传入
sum(...$arr);          // 透传 $arr，无需额外拷贝
sum(1, ...$tail, 2);   // 混合使用，合并为一个数组传入
```

> 可变参数必须为最后一个形参，且不能有默认值。`func_get_args()` / `func_num_args()` / `func_get_arg($i)` **仅**在可变参数函数内可用；定参函数不可用。

### 闭包 {#closure}

闭包用 `function (params) use (vars) { body }` 语法声明，是 `callable` 类型的值。`use` 子句显式捕获外部变量，支持多捕获；嵌套闭包亦被支持。

```php
class Main {
    public function main(): void {
        int $factor = 3;
        string $prefix = ">>";

        // use 捕获多个外部变量（按值）
        $formatter = function(int $x) use ($factor, $prefix): string {
            return $prefix . ($x * $factor);
        };
        echo $formatter(10);          // >>30

        // 嵌套闭包：内层闭包捕获外层闭包的变量
        $multiplier = function(int $base): callable {
            int $step = 2;
            return function(int $x) use ($base, $step): int {
                return ($x + $base) * $step;
            };
        };
        $m = $multiplier(10);
        echo $m(5);                   // (5 + 10) * 2 = 30
    }
}
```

> 闭包作用域通过 `use` 在声明时固定，**不支持** `Closure::bind` / `->bindTo` / `Closure::call` / `Closure::fromCallable` 等运行时重绑定。
> 闭包常作为 `Thread`、`Channel`、`Future` 等的回调，详见 [多线程](docs/threads.md)。

### 箭头函数 {#arrow}

箭头函数是闭包的简洁写法。**强制参数类型 + 返回类型声明**，且**自动捕获**当前作用域中用到的变量（无需 `use`）。两种形态：

- **表达式形态**：`fn(params): T => expr` —— 单表达式求值即返回值。
- **块体形态**：`fn(params): T => { stmts }` —— TinyPHP 扩展（PHP 原生仅支持单表达式），可写多条语句，须以 `return` 结尾（`void` 类型除外）。

```php
class Main {
    public function main(): void {
        int $factor = 3;

        // 表达式形态（自动捕获 $factor）
        $double = fn(int $x): int => $x * $factor;
        echo $double(5);              // 15

        // 块体形态（须以 return 结尾）
        $blk = fn(int $x): int => {
            int $y = $x + 1;
            return $y * $factor;
        };
        echo $blk(2);                // (2 + 1) * 3 = 9

        // void 块体箭头函数（无 return）
        $printer = fn(string $s): void => { echo $s . "\n"; };
        $printer("hi");

        // 常用于回调链
        $nums = [1, 2, 3, 4];
        $squared = array_map(fn(int $n): int => $n * $n, $nums);
    }
}
```

> 箭头函数与 `function() use() {}` 闭包的差别：箭头函数**自动捕获**用到的外层变量（隐式 `use`），普通闭包必须**显式** `use` 列出捕获变量。
> 块体箭头函数 `fn(): T => { stmts }` 是 TinyPHP 扩展语法，PHP 原生仅支持单表达式 `fn() => expr`。

### Generator 生成器 {#generator}

Generator 用 `yield` 关键字声明，函数返回 `Generator` 类型。支持 `yield` 产出值、`yield $k => $v` 键值对、`send()` 双向传值、`getReturn()` 获取返回值、`foreach` 迭代。

```php
// 基础 yield
function counter(): Generator {
    yield 1;
    yield 2;
    yield 3;
    return 99;                       // 配合 getReturn()
}

// yield 键值对
function pairs(): Generator {
    yield "a" => 1;
    yield "b" => 2;
}

// send() 双向传值
function echoer(): Generator {
    $msg = yield;                    // 产出 null，等待 send
    while (true) {
        $msg = yield "got:" . $msg;  // 产出并等待下次 send
    }
}

class Main {
    public function main(): void {
        // foreach 迭代
        foreach (counter() as $v) {
            echo $v;                 // 1 2 3
        }

        // foreach 键值迭代
        foreach (pairs() as $k => $v) {
            echo "$k=$v ";            // a=1 b=2
        }

        // getReturn() 取返回值
        $g = counter();
        foreach ($g as $v) {}        // 必须先迭代完
        echo $g->getReturn();         // 99

        // send() 双向传值
        $e = echoer();
        $e->current();                // 启动到第一个 yield
        echo $e->send("hello");       // got:hello
        echo $e->send("world");       // got:world
    }
}
```

> **不用 `yield` 时零开销**：不含 `yield` 的普通函数完全不受 Generator 机制影响。
> Generator 函数中**不可**用字符串函数名作 `callable`（如 `gen(1, 3, "apply")`），须改用闭包 `gen(1, 3, fn($x) => apply($x))`。
