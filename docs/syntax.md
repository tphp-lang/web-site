## 语法特性 {#syntax}

基于 PHP 8.5 强类型语法，约 80% PHP 兼容性。下列特性均已在 AOT 编译器中实现。

### 控制流 {#control-flow}

- `if` / `elseif` / `else`
- `while` / `do-while`
- `for` / `foreach`
- `switch` / `match`
- `break` / `continue`
- `goto`

### OOP 面向对象 {#oop}

- `class` / `extends`
- `abstract` / `interface` / `implements`
- `trait` + `use`
- `enum`
- `__construct(public $x)` 属性提升
- `__destruct`
- `static` / `final` / `readonly`
- `instanceof` / `self::` / `$this`
- `?->` 空安全运算符

### 闭包 {#closure}

- `function() use($x) {}`
- `fn($x): T => expr` 箭头函数
- 多捕获
- 嵌套闭包

### 异常 {#exception}

- `try` / `catch` / `finally`
- `throw`
- `error()` 抛出
- `Type|Exception` 联合返回类型
- `never`

### 类型系统 {#type-system}

- `int` `float` `string` `bool` `array`
- `array<T>` 泛型数组
- `callable` / `void` / `mixed` / `self`
- 类类型

### 运算符 {#operator}

- 完整 15 级优先级
- 三元 `?:`
- 空合并 `??`
- 太空船 `<=>`

### 命名空间 {#namespace}

- `namespace A\B`
- `use A\{B,C}` 分组导入
- `use function` / `use const`

### Generator 生成器 {#generator}

- `yield`
- `yield $k => $v`
- `send()`
- `getReturn()`

> **不支持：** `eval()`、`$$var`、`include/require`、`__call/__get/__set`。这些特性在 AOT 物理不可行，详见 README 中的替代方案。
