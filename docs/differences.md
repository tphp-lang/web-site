## 与 PHP 的差异 {#differences}

> tphp 是 PHP→C AOT 编译器，不是 PHP 解释器。本文档集中汇总与原生 PHP 的四类差异，供迁移与对照参考。前置阅读：[语法特性](docs/syntax.md)。

### AOT 不可行项 {#infeasible}

AOT 编译在编译期完成类型确定与符号绑定，无运行时解释器、符号表或动态分发。以下 PHP 特性依赖运行时机制，**物理不可行**，永久不支持。

| 特性 | 不可行原因 | 替代方案 |
|------|-----------|---------|
| `eval()` | AOT 无运行时解析器，无法在运行时编译执行字符串 | `switch`/`match` 分支调度，或回调分发 |
| `create_function()` | 同 `eval()`，运行时动态创建函数无编译期符号 | 闭包 `function() {}` 或 `fn() =>` |
| `assert($str)` 字符串断言 | 字符串参数需运行时求值为代码 | 直接写布尔表达式 `assert($x > 0)` |
| `$$var` 可变变量 | 编译期无法确定变量名，无运行时符号表 | 关联数组映射：`$map[$key]` 替代 `$$key` |
| `${expr}` 动态变量名 | 同 `$$var`，运行时求值变量名 | 关联数组映射 |
| `include` / `require` / `include_once` / `require_once` | 无运行时文件加载，编译期需确定全部符号 | `#include` 引入 C 头文件，或多文件编译 `tphp a.php b.php` |
| `__call` / `__callStatic` | 无运行时动态分发，方法表编译期固定 | 显式定义方法，或在单个方法内用 `switch` 分发 |
| `__get` / `__set` | 类布局编译期固定，无动态属性访问钩子 | 预声明所有属性；动态属性用 `stdClass` 或关联数组 |
| `__toString` / `__invoke` / `__clone` 等魔术方法 | 需运行时动态分发或序列化支持 | 显式方法或 `->data` 访问 |
| `Reflection*` 全系列 | AOT 无运行时元数据，无内省能力 | 注解系统（编译期消费，零开销） |
| `$fn()` / `$obj->$m()` / `call_user_func()` | 编译期不知函数/方法名 | 回调 map：`$fn = $map[$name]; $fn($args);` |
| 动态属性 `$obj->dynamicProp = 1` | 类布局编译期固定，无动态属性表（PHP 8.2 已弃用） | 预先声明属性，或用 `stdClass` / 关联数组 |
| `$GLOBALS` / `compact()` / `extract()` / `get_defined_vars()` | 无运行时全局符号表 | 显式传参 / `use` 闭包捕获 |
| `func_get_args()`（定参函数） | 参数已固化为 C 形参，无统一容器 | 可变参数 `...$args`（该场景下已支持） |
| `debug_backtrace()` / `debug_print_backtrace()` | 无运行时栈帧 | — |
| `ArrayAccess` / `Iterator` / `Stringable` 接口语义 | 需运行时动态分发（`implements` 仅记录，不生效） | foreach 仅支持 array 和 Generator |

### 不做项 {#not-done}

以下特性理论上可实现，但与 AOT 类型固定哲学冲突或收益有限，**权衡后不做**。

| 特性 | 不做原因 |
|------|---------|
| `?int` 可空类型 | AOT 下 null 分支需运行时分发，破坏类型固定优势；用 `mixed` 替代，或拆分为两个重载函数 |
| `int\|string` 普通联合类型 | 等同 `mixed`，类型信息丢失；`Type\|Exception` 返回类型仅作文档提示，非真联合 |
| `protected` 可见性 | 设计取舍，仅支持 `public` / `private` |
| 命名参数 | AOT 下函数签名编译期已知，命名参数无意义；仅位置参数（注解同样仅位置参数） |
| `clone` 关键字 | 需 `__clone` 动态分发，对象无通用深拷贝；显式构造新对象替代 |
| `static` 类属性标志丢失 | 语法接受 `public static int $x = 0;`，但 static 标志当前会丢失（编译为实例属性）；仅内置类（Thread/Parallel/Enum）支持真静态 |
| `final` 方法修饰符 | `final` 仅支持类级别；写 `final public function` 报语法错误 |
| `??=` 空合并赋值 | 未实现；用 `$a = $a ?? $b;` 展开（`??` 已支持数组键存在性检查） |
| `declare(strict_types=1)` | tphp 本身即强类型 AOT，`declare` 无意义 |
| first-class callable `strlen(...)` | AOT 下函数编译期已知，可用闭包或直接调用替代，额外语法无收益 |
| `true`/`false`/`null` 字面量类型 | AOT 零性能收益，编译期验证成本高收益低，与 `?T` 不做的哲学冲突 |
| `static` 返回类型 | AOT 无后期绑定，语义与 `self` 完全相同 |
| DNF / intersection 类型 `A&B` | 实现复杂，收益有限 |
| `\u{XXXX}` Unicode 转义 | C 不支持 `\u{}` 语法；用 `\xXX` 或直接嵌入 UTF-8 字符 |
| 返回引用 `function &f()` | AOT 类型固定下无意义；对象按指针传递已是引用 |
| `callable $fn = "func"` 默认值 | 编译时无法将字符串函数名转换为函数指针；每次调用时显式传入闭包替代 |

### 语义差异 {#semantic}

以下特性在 tphp 中可使用，但运行时行为与原生 PHP 存在差异，迁移时需注意。

| 特性 | tphp 行为 | PHP 行为 |
|------|----------|---------|
| `===` 严格比较 | 与 `==` **等价**：类型编译期固定，"类型不同"不存在 | `===` 检查类型与值，`==` 弱类型转换 |
| `!==` | 与 `!=` 等价（同上） | 严格不等 |
| `match` 表达式比较 | 与 `==` 一致（类型固定） | 严格 `===` 比较 |
| `strpos()` 未找到 | 返回 `-1`（int 类型固定） | 返回 `false`（bool） |
| `strrpos()` / `stripos()` / `strripos()` 等查找函数 | 未找到返回 `-1` | 返回 `false` |
| 数组实现 | 有序映射，int/string 键 O(1) 查找 | Zend HashTable 有序映射 |
| `array<T>` 泛型数组 | 显式声明后 push 不同类型报编译错误；`array<int>` 紧凑存储省 67% 内存 | 数组元素类型自由 |
| Generator 实现机制 | 基于 stackless 协程 | Zend VM 内部 Generator 对象 |
| Generator `callable` 字符串函数名 | **不可行**，须用闭包 `gen(1, 3, fn($x) => apply($x))` | `gen(1, 3, "apply")` 可行 |
| Generator 不使用 yield | 零开销，编译为普通函数 | 普通函数无差异 |
| macOS + TCC 下的 Generator | 使用 OS 线程模拟（性能略低于协程） | 正常 |
| 时间函数 `date()` / `time()` / `mktime()` 等 | 返回类型编译期固定（string/int）；时区与格式化语义与 PHP 一致 | 返回 string/int，动态类型 |
| 异常机制 | 编译为原生 C 异常 | Zend VM 异常机制 |
| `catch (\Throwable $e)` | **不支持**（`Throwable` 是接口，无法动态分发）；用 `catch (Exception $e)` | 支持 |
| `get_class()` 匿名类 | 返回 `_AnonClass${N}` | 返回 `class@anonymous` |
| 属性访问 | 直接函数指针调用，无运行时可见性检查 | 运行时可见性检查 |
| 闭包作用域 | 编译期通过 `use` 固定，无法运行时重绑定 | `Closure::bind` / `bindTo` 可运行时重绑定 |
| `null` 合并 `??` | 数组键 `$a["k"] ?? d` 编译为 `array_key_exists` 检查 | 运行时 isset 检查 |

### 性能差异 {#performance}

tphp 将 PHP 编译为原生 C 二进制，无 Zend VM、无 OPCache、无需 PHP 运行时。性能数据来自 TinyPHP 项目基准测试（PHP 8.5.1 vs TinyPHP GCC -O2）：

| 场景 | 性能倍数 | 说明 |
|------|---------|------|
| 数组遍历 / 读取 | **18-36x** | str/int 键 O(1) 查找，方法调用近乎 0ns |
| OOP 创建（`new` + `unset`） | **反超 2.1x** | 直接字段访问，无 Zend 属性表查找 |
| OOP 属性写入 | **反超 2.6x** | 直接字段访问，无 Zend 属性表查找 |
| 字符串拼接（concat-4） | **快 6 倍** | 多片段拼接编译期合并为单次分配 |
| 编译器优化 | **额外 3-10x** | GCC/Clang -O2 比 TCC 再快（`tphp -cc gcc` 即可获得） |

> **数据来源**：TinyPHP 项目 `bench/run_bench.php` 基准测试，对比 PHP 8.5.1 解释执行与 TinyPHP GCC -O2 原生二进制。详见源项目 [BENCHMARK_RESULTS.md](https://github.com/KingBes/TinyPHP/blob/main/BENCHMARK_RESULTS.md)。运行方式：`php bench/run_bench.php gcc php`。

### 迁移指引 {#migration}

从 PHP 迁移到 tphp 的建议步骤：

1. **检查不可行项**（阻断性）：扫描源码，识别 `eval`、`create_function`、`$$var`、`include/require`、`__call/__get/__set`、`Reflection*`、`call_user_func`、动态属性等 AOT 不可行特性，按「[AOT 不可行项](#infeasible)」表格替换为替代方案。这一步决定代码能否编译通过。

2. **调整类型声明**（编译期报错）：
   - 移除 `?int` 可空类型，改用 `mixed` 或拆分重载函数
   - 移除 `int|string` 联合类型（`mixed` 已支持）；保留 `Type|Exception` 返回类型提示
   - 为类属性、类常量补充**必填**类型声明（`public $x` 会被拒绝）
   - 移除 `declare(strict_types=1)`（tphp 本身强类型）

3. **替换魔术方法**：移除 `__call/__get/__set/__callStatic/__toString/__invoke/__clone` 等，改为显式方法；动态属性改用 `stdClass` 或关联数组；`clone` 改为显式构造新对象。

4. **重构动态调用**：`$fn()` / `$obj->$m()` 改为回调 map（`$fn = $map[$name]; $fn($args);`）；`include` 改为多文件编译（`tphp main.php demo.php`）或 `#include` 引入 C 头文件。

5. **调整可见性与修饰符**：`protected` 改为 `public` 或 `private`；移除 `final` 方法修饰符（仅类级别支持）；`static` 属性注意标志丢失限制（仅内置类支持真静态）。

6. **注意语义差异**（运行时行为）：检查 `strpos` 等返回值（`-1` vs `false`）；`===` 与 `==` 已等价无需严格比较；Generator 的 `callable` 参数改用闭包；`catch (\Throwable)` 改为 `catch (Exception)`。

7. **添加入口类**：确保有全局命名空间（无 `namespace`）的 `class Main` 与 `public function main(): void` 入口；移除游离代码（所有语句必须在类/函数内）。

8. **编译与测试**：用 `tphp main.php --debug` 配合 `#debug` 指令逐文件验证输出；逐步迁移，先核心逻辑后辅助模块。多文件用 `@multi @with` 注解声明入口。

9. **性能验证**：迁移完成后用 `tphp -cc gcc` 启用 GCC -O2（比默认 TCC 快 3-10x），对比原生 PHP 验证性能提升。

> **迁移优先级**：先识别不可行项（阻断性，不替换无法编译），再调整类型与可见性（编译期报错，易发现），最后处理语义差异（运行时行为，需测试验证）。完整支持清单见 [语法特性](docs/syntax.md#supported)。
