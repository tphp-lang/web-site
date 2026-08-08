## 扩展系统 {#extensions}

对标 PHP extension，TinyPHP 通过一组以 `#` 开头的**预处理指令**在 PHP 源码中声明 C 依赖、控制编译产物。所有指令在编译期处理，运行时零开销：未引入的扩展不进入二进制，引入的扩展函数直接编译为原生代码。

扩展分两层：

- **`ext/` 按需扩展** — 通过 `#import` 按需引入（`pcntl`/`curl`/`sqlite3`/`ui` 等），C 依赖由扩展自身的 `.php` 通过 `#flag` 显式声明。
- **`include/` 常驻扩展** — 随 C 运行时常驻编译（`zlib`/`json`/`hash` 等），无需 `#import`。

与 C 互操作的完整能力（`C->func()`、`C.Type` 注解、`phpc_*` 桥接）见 [PHPC 互操作](docs/phpc.md)，本文聚焦扩展加载与 C 依赖声明。

### 扩展指令 {#directives}

TinyPHP 的预处理指令均为**顶层声明**（`#if`/`#debug` 等部分可在函数体内使用），在编译期求值并生效。完整指令清单如下：

| 指令 | 作用 | 详见 |
|------|------|------|
| `#include` | 引入 C 头文件 | [§ #include](#include) |
| `#flag` | 链接 C 库、追加编译标志、登记 `.c` 源文件 | [§ #flag](#flag) |
| `#import` | 按需引入 `ext/` 内置扩展 | [§ #import](#import) |
| `struct C.Name {}` | 声明 C 结构体字段布局（替代已移除的 `#cstruct`） | [§ struct C.Name {}](#cstruct) |
| `#[Export("name")]` | 导出 C 符号（配合 `-shared`） | [§ #[Export]](#export) |
| `#callback` | 声明 C 回调函数签名 | [§ #callback](#callback) |
| `#if` / `#elseif` / `#else` / `#endif` | 条件编译 | [§ 条件编译](#cond) |
| `#debug` | 声明测试预期输出（配合 `--debug`） | [快速开始](docs/quickstart.md) |

> **关于常见命名误区**：TinyPHP **没有**独立的 `#lib`、`#cinit`、`#c`、`#phpc` 指令——链接库由 `#flag -l<lib>` 承担；动态库的运行时初始化由 `-shared` + `#[Export]` 自动完成；内联 C 代码通过 `C->func(args)` 调用 + `#include` 头文件实现；PHPC 是 C 互操作系统的名称（详见 [phpc.md](docs/phpc.md)），并非指令。下文按真实指令逐条详述。

#### #include — 引入 C 头文件 {#include}

把 C 头文件引入编译，使 `C->func()` / `C->CONST` / `C.Type` 能解析到对应声明。

**语法**：

```php
#include "path/to/header.h"        // 项目头文件 → #include "path/to/header.h"
#include <system.h>                // 系统头文件 → #include <system.h>
#include Windows <windows.h>       // 仅 Windows 引入（可选 OS 过滤）
#include Linux "linux_only.h"      // 仅 Linux 引入
```

`#include` 路径中支持 PHP 魔术常量展开，便于跨目录引用：

| 常量 | 展开为 | 示例 |
|------|--------|------|
| `__DIR__` | 源文件所在目录（绝对路径） | `__DIR__ . "/../demo.h"` |
| `__EXT__` | 编译器 `ext/` 目录 | `__EXT__ . "/pcntl/src/pcntl.h"` |
| `__INC__` | 编译器 `include/` 目录 | `__INC__ . "/common.h"` |
| `__CMD__` | 执行 `tphp` 的工作目录 | `__CMD__ . "/my_lib.h"` |
| `DIRECTORY_SEPARATOR` | `/`（Linux/macOS）或 `\`（Windows） | 跨平台路径拼接 |

**示例**：

```php
#include __DIR__ . "/my_lib.h"          // 引入项目头文件
#include __EXT__ . "/pcntl/src/pcntl.h" // 引入扩展头文件
#include <math.h>                       // 引入系统头文件
```

> 安全：项目头路径校验需在项目根目录内；`#include <...>` 仅允许标准 C 库 + 常见 POSIX/Windows 头，按文件名去重。

#### #flag — 链接 C 库与编译标志 {#flag}

向编译器命令行追加标志，承担三件事：**链接 C 库**（`-l`）、**追加编译选项**（`-O2`/`-D`/`-I` 等）、**登记 `.c` 源文件**（flags 中的 `.c` 自动加入编译列表）。

**语法**：

```php
#flag -lm                           // 链接数学库（全平台）
#flag Linux -lrt                    // 仅 Linux 链接 librt
#flag Windows -luser32              // 仅 Windows 链接 user32
#flag GCC -O2 -DNDEBUG              // 仅 GCC 优化
#flag Clang -Wall -Werror           // 仅 Clang 严格警告
#flag __DIR__ . "/my_lib.c"         // 登记 C 源文件（自动加入编译）
#flag __EXT__ . "pcntl/src/pcntl.c" // 登记扩展 C 源文件
```

`#flag` 的过滤前缀顺序为 `[编译器] [平台]`，均可省略；不写表示全平台。`MacOS` 映射到 `Darwin`。

**链接第三方 C 库**：当需要使用未内置的第三方 C 库（如 `libcrypto`、`libcurl` 等系统库，或自编译的 `.a`/`.so`/`.dll`）时，用 `#flag -l<name>` 链接，必要时用 `#flag -L<path>` 补充搜索路径、`#flag -I<path>` 补充头文件搜索路径：

```php
#include <openssl/evp.h>            // 引入第三方库头文件
#flag -lcrypto                      // 链接 libcrypto
#flag -L/usr/local/lib              // 补充库搜索路径
#flag -I/usr/local/include          // 补充头文件搜索路径
```

> 安全：`#flag` 受 Shell 元字符阻断（`` ` `` `$` `|` `;` `&` `>` `<` `\n` `\` 直接报错）、Flag 前缀白名单（仅 `-I -L -l -D -U -O -W -std -m -f -g -pthread -static -shared -B`）、危险 Flag 黑名单（`-fplugin`/`-specs`/`-wrapper`/`-ld=` 报错，防 GCC 插件注入），`-I`/`-L` 路径会消解 `../`。

#### #import — 引入内置扩展 {#import}

按需引入 `ext/{name}/` 下的内置扩展，扩展函数直接编译进二进制，未引入的扩展零开销。

**语法**：

```php
#import pcntl            // 引入进程控制扩展
#import sqlite3          // 引入 SQLite 扩展
#import curl             // 引入 curl 扩展
```

**`#import` 做的事情**：只自动引入 `ext/{name}/src/*.php`（C 依赖由扩展自身的 `.php` 通过 `#flag` 显式声明，如 `#flag __EXT__ . "name/src/name.c"`）。头文件（`.h`）不会被自动包含，需用 `#include` / `#flag -I` 手动引入。扩展名仅接受 `\w[\w\-]*`（字母/数字/下划线/连字符），校验路径需在 `ext/` 目录内。

```php
<?php
#import pcntl            // 引入进程控制扩展

class Main {
    public function main(): void {
        $pid = pcntl_fork();
        if ($pid === 0) {
            echo "child\n";
        }
    }
}
```

#### struct C.Name {} — C 结构体字段布局 {#cstruct}

声明 C 结构体的字段布局，使 PHP 侧可对 C 结构体指针做**原生字段访问**（`$p->field`），无需编写 C getter/setter。

> **历史变更**：早期版本使用 `#cstruct Name { ... }` 指令声明布局，现已**移除**，改用 `struct C.Name {}` 声明。源码中遇到 `#cstruct` 会报错并提示改用 `struct C.Name { C.Type field; ... }` 或 `struct C.Name;`（不透明类型）。

**语法**：

```php
struct C.Name {
    C.Type field;
    C.Type field;
    // ...
}

struct C.Name;          // 不透明类型（无字段，仅占位指针类型）
```

字段类型使用 `C.type` 注解（如 `C.double`/`C.int`/`C.char*`）。`struct C.Name {}` 只声明字段布局以启用字段访问，**不替代** `#include` 引入的真实 C 定义。

**示例**：

```php
#include "include/demo.h"

struct C.Point {
    C.double x;
    C.double y;
}

struct C.Rect {
    C.int id;
    C.double x;
    C.double y;
    C.double w;
    C.double h;
}

class Main {
    public function main(): void {
        C.Point* $p = C->point_create(3.0, 4.0);
        defer C->point_free($p);
        echo $p->x;          // 原生读
        $p->y = 10.0;        // 原生写

        float $norm = C->sqrt($p->x * $p->x + $p->y * $p->y);  // 字段参与运算
        echo $norm;          // 5
    }
}
```

#### #[Export("name")] — 导出 C 符号 {#export}

标记独立函数导出为 C 函数，配合 `-shared` 编译选项生成可被外部 C 代码调用的动态库（`.dll`/`.so`/`.dylib`）。它是一个内置注解，与用户注解系统（`#[Attribute]`）独立，仅控制 C 符号导出。

**语法**：

```php
#[Export("c_function_name")]
function phpFunc(int $a, int $b): int {
    return $a + $b;
}
```

- 参数为字符串字面量，指定导出的 C 函数名（必须为合法 C 标识符，全局唯一）。
- 仅可用于独立函数（`function`），用于方法报语法错误。
- 非 `-shared` 模式下静默忽略，函数仍可正常调用。

**类型约束**：参数与返回值允许 `int`/`float`/`bool`/`string`/`void`/`C.Type`，**禁止 `array`**；`string` 直接暴露 `t_string*`（不桥接 `char*`），C 侧需包含 `tphp_runtime.h`。

**规则**：

- `-shared` 模式下运行时会自动初始化，无需手写初始化代码。
- **Main 类**：`-shared` 模式仍需 Main 入口类（不豁免），但 `main()` 不被执行。

**编译命令**：

```bash
tphp lib.php -shared -o mylib.dll    # Windows
tphp lib.php -shared -o mylib.so     # Linux
tphp lib.php -shared -o mylib.dylib  # macOS
```

`#[Export]` 可与用户注解共存于同一函数，互不干扰：

```php
#[Export("multi_fn")]     // 导出为 C 函数（-shared 模式）
#[ROUTE("/api/multi")]    // 收集到 ROUTE 注解数组（所有模式）
function multiFn(int $n): void { ... }
```

#### #callback — 声明 C 回调签名 {#callback}

声明一个 C 回调函数签名，配合 `phpc_thunk('name', $closure)` 把 PHP 闭包传给需要特定签名 C 回调的 C 库（支持任意签名）。

**语法**：

```php
#callback ret_type name(param_types)
```

**示例**：

```php
#callback double fold_cb(int32_t idx, double val)   // 声明 C 回调签名（顶层指令）

class Main {
    public function main(): void {
        $fn = function(int32_t $i, double $v): double { return $v * 2.0; };
        C->fold_dbl($data, $len, phpc_thunk('fold_cb', $fn));
    }
}
```

> 另一种「有 env 回调」方式 `phpc_fn_i32` + `phpc_env` 无需 `#callback` 声明，详见 [PHPC 回调互操作](docs/phpc.md#callback-interop)。

#### #if / #elseif / #else / #endif — 条件编译 {#cond}

编译期求值的条件编译：非命中分支的代码直接跳过（不解析、不类型检查），可包裹任意顶层声明或函数体内语句。

**条件表达式**支持 `!`、`&&`、`||`、`()` 组合和标识符（大小写不敏感）：

| 类别 | 标识符 | 判定依据 |
|------|--------|----------|
| OS | `Windows`/`Win`、`Linux`、`MacOS`/`Darwin`/`Mac`、`Android` | 目标 OS（取 `-os` 参数或宿主） |
| 编译器 | `TCC`/`TinyC`、`GCC`、`Clang`、`NDK`/`NDKClang` | 当前编译器类 |
| 架构 | `x86_64`/`amd64`/`x64`、`aarch64`/`arm64`、`armv7a`/`armeabi-v7a`、`i686`/`x86` | 目标架构 |
| 模式 | `debug`、`prod` | `--debug` 与否 |

未知标识符视为 `false`（前向兼容，不报错）。

```php
// 条件引入头文件和链接库
#if Windows
    #include <windows.h>
    #flag -luser32
#elseif Linux
    #include <unistd.h>
    #flag -lrt
#elseif Darwin
    #include <unistd.h>
    #flag -liconv
#endif

// 函数体内条件代码块
function init(): void {
    #if Windows && TCC
        // TCC+Windows 特定 workaround
    #endif
}
```

### 指令依赖与顺序 {#order}

指令之间没有强制的语法先后要求，但存在**语义依赖**与**推荐顺序**，遵循「声明 → 引入 → 链接 → 使用」链路：

```text
1. #import <ext>           引入扩展的 .php stub（stub 内部已自含 #flag + #include）
2. #include "header.h"     引入 C 头文件声明（C->func/C.Type 依赖此解析符号）
3. #flag -l<lib> / .c      链接库 / 登记 C 源文件（编译期生效，位置不敏感）
4. struct C.Name {}        声明结构体字段布局（$p->field 访问依赖此 + #include 真实定义）
5. #callback ret name(...) 声明 C 回调签名（phpc_thunk 依赖此）
6. #[Export("name")]       标记函数导出（与函数声明同处）
7. function/class/...      函数体中使用 C->func()、C.Type、$p->field 等
```

**关键依赖关系**：

| 依赖 | 前置 | 说明 |
|------|------|------|
| `C->func()` 调用 | `#include "header.h"` | 头文件提供函数声明，否则 C 编译器报隐式声明警告/错误 |
| `C->CONST` 访问 | `#include "header.h"` | 头文件提供宏/枚举定义 |
| `C.Type` 注解 | `#include "header.h"` | 结构体类型需先声明 |
| `$p->field` 访问 | `struct C.Name {}` + `#include` | 布局声明启用字段访问，真实 C 定义由 `#include` 提供 |
| `phpc_thunk('name', ...)` | `#callback name(...)` | thunk 按 `#callback` 签名生成 |
| `-shared` 导出 | `#[Export("name")]` | 无 `#[Export]` 时 `-shared` 不导出任何符号 |
| 扩展的 C 实现 | `#flag ext/.../x.c` | `#import` 只引入 `.php`，`.c` 由 stub 内的 `#flag` 登记 |

**位置规则**：`#flag` 必须放在文件顶部（`namespace`/`use`/`class`/`function` 声明之前），否则编译报错；`#include`/`#import`/`struct C.Name {}`/`#callback` 同为顶层声明。`#import` 通常置于文件最上方，因为它引入的 `.php` stub 会带来自身的 `#flag`/`#include`。

**`#flag` 顺序无关性**：`#flag` 收集所有标志后统一追加到编译器命令行，多次声明按平台/编译器过滤后去重合并，因此 `-l`/`-I`/`.c` 的书写先后不影响最终链接结果。

### 扩展目录结构 {#structure}

`ext/` 下每个扩展是一个独立目录，命名遵循 `#import` 的 `\w[\w\-]*` 规则。约定 `src/` 存放源码，头文件可放扩展根或 `src/` 内。两种实现方式可混用：

| 方式 | 做法 | 适用场景 |
|------|------|---------|
| **C 直接**（推荐） | `.c` 中写 `tphp_fn_xxx()`，`.php` stub 用 `#flag` 声明 `.c` 依赖 + `#include` 引入 `.h` | 简单类型转换，函数签名与 PHP 一致 |
| **PHPC 包装** | `.php` 中写 PHP wrapper + `.c` 中写原始 C 实现，通过 `C->func()` 调用 | 复杂类型桥接、需要对象封装 |

**标准目录布局**：

```text
ext/
├── demo/               ← PHPC 包装示例（.php + .c 混写）
│   ├── demo.h          ← C 头文件（函数声明）
│   └── src/
│       ├── demo.c      ← C 实现（普通 C 函数）
│       └── demo.php    ← #flag demo.c + #include demo.h + PHP wrapper
├── pcntl/              ← C 直接模式（.php stub 声明 C 依赖）
│   └── src/
│       ├── pcntl.h     ← C 头文件
│       ├── pcntl.c     ← C 实现
│       └── pcntl.php   ← stub：仅 #flag pcntl.c + #include pcntl.h
├── exif/               ← 零自定义 C 代码
│   └── src/
│       └── exif.php
└── ui/                 ← 图形界面
    ├── android/        ← Android 工程模板（Gradle + Manifest + MainActivity）
    ├── compat/         ← TCC 兼容头文件
    └── src/
        ├── ui.h        ← C 包装层
        ├── ui.php      ← App/Window/Event/Graphics
        └── ui_widget.php ← Widget/Button/Label/...
```

**stub 文件约定**（C 直接模式）：`ext/{name}/src/{name}.php` 只声明 C 依赖，不含 PHP 逻辑：

```php
<?php
// ext/pcntl/src/pcntl.php — stub
#flag __EXT__ . "pcntl/src/pcntl.c"
#include __EXT__ . "pcntl/src/pcntl.h"
```

使用方 `#import pcntl` 后，PHP 侧调用 `pcntl_fork()` 即可直接命中对应的 C 函数。

> `demo` 目录为扩展开发示例，非正式扩展。

### C 侧编写规范 {#c-conventions}

#### 函数命名与签名

C 侧函数按实现方式分两类，命名规范不同：

| 模式 | C 函数命名 | 调用方式 | 示例 |
|------|-----------|---------|------|
| **C 直接** | `tphp_fn_{PHP函数名}` | PHP 直接调用 | `tphp_fn_pcntl_fork(void)` |
| **PHPC 包装** | 任意合法 C 标识符 | 通过 `C->func(args)` 显式调用 | `point_create(double, double)` |

**C 直接模式**签名使用 TinyPHP 运行时类型，与 PHP 类型一一对应：

| PHP 类型 | C 类型 | 说明 |
|----------|--------|------|
| `int` | `t_int`（`int64_t`） | 64 位有符号整数 |
| `float` | `t_float`（`double`） | IEEE 754 双精度 |
| `string` | `t_string` | 字符串 |
| `bool` | `t_bool` | 布尔值 |
| `array` | `t_array*` | 有序映射（int/string 键） |
| `void` | `void` | 仅返回类型 |

```c
// ext/pcntl/src/pcntl.h —— C 直接模式签名
t_int  tphp_fn_pcntl_fork(void);
t_int  tphp_fn_pcntl_waitpid(t_int pid, t_int *status, t_int options);
void   tphp_fn_pcntl_exec(t_string path);
t_string tphp_fn_pcntl_strerror(t_int no);
```

```c
// ext/pcntl/src/pcntl.c —— 实现（POSIX 平台）
t_int tphp_fn_pcntl_fork(void) { return (t_int)fork(); }
t_string tphp_fn_pcntl_strerror(t_int no) {
    return ext_mk_str(strerror((int)no));   // 用 ext_mk_str 构造 t_string
}
```

> 跨平台不可用的扩展（如 `pcntl` 在 Windows）应提供 stub 实现：打印 Fatal error 并退出。

**PHPC 包装模式**写普通 C 函数，在 PHP 侧用 `C->func()` 调用并做类型桥接：

```c
// ext/demo/src/demo.c —— 普通 C 函数
int create_class_a(int a, int b) { return a + b; }
int class_a_add(int c, int d)    { return c + d; }
```

```php
// ext/demo/src/demo.php —— PHP wrapper 封装为对象
#include __EXT__ . "demo/demo.h"
#flag __EXT__ . "demo/src/demo.c"

class DemoA {
    public int $c;
    public function __construct(int $a, int $b) {
        $this->c = C->create_class_a(c_int($a), c_int($b));  // c_int: int → int32_t
    }
    public function add(int $d): int {
        int $c = C->class_a_add($this->c, c_int($d));
        return php_int($c);                                   // php_int: C int → PHP int
    }
}
```

#### 与 PHPC 的类型桥接

C 直接模式中 PHP 值已是运行时类型，无需桥接；PHPC 包装模式跨 C 边界时需用桥接函数。核心桥接（详见 [PHPC 类型桥接](docs/phpc.md#type-bridge)）：

| 方向 | 函数 | 转换 | 所有权 |
|------|------|------|--------|
| PHP → C | `c_int($x)` | `int` → `int32_t`（有截断） | 值拷贝 |
| PHP → C | `c_str($s)` | `string` → `const char*`（借用内部缓冲） | **借用**，不可 free |
| C → PHP | `php_int($v)` | C int → PHP `int` | 值拷贝 |
| C → PHP | `php_str($s)` | `const char*` → PHP `string`（深拷贝） | 自动释放 |

**数组 / 字符串 / mixed 桥接**：

- `string` — C 直接模式的 `tphp_fn_*` 形参直接收字符串类型，无需 `c_str`。
- `array` — 有序映射，PHP → C 用 `phpc_arr_int/dbl/str($arr)` 提取为紧凑 C 数组（`int32_t*`/`double*`/`char**`）；C → PHP 用 `phpc_new_arr_int/dbl/str(src, len)` 构造。
- `mixed` — 对应异构数组或联合类型。

```php
// array 桥接示例
function sum_array(array $arr): int {
    C.int32_t* $data = phpc_arr_int($arr);            // → int32_t* (malloc, 自动注册)
    $result = C->sum_ints($data, c_int(count($arr)));
    return php_int($result);
}
```

#### 内存管理

C 互操作绕过 PHP 侧 GC，**搞错所有权会导致 double-free 或泄漏**。首选 `defer` 在退出时自动释放：

```php
C.Point* $p = C->point_create(3.0, 4.0);   // C 库返回的 transfer 指针
defer C->point_free($p);                    // 退出自动释放
```

| 来源 | 所有权 | 处理方式 |
|------|--------|---------|
| `C->malloc()` / C 库返回的 `T*` | **transfer**（调用方负责释放） | `defer C->free($p)` / `defer C->point_free($p)` |
| `phpc_arr_int/dbl($arr)` | malloc，**自动注册** | 无需手动释放（循环内避免堆积可 `phpc_free`） |
| `phpc_arr_str($arr)` | malloc，**不自动注册** | `defer phpc_free_str_arr($a, $n)` |
| `c_str($s)` / `phpc_obj($obj)` | **借用** | 不可 free |
| `phpc_new_arr_*` / `phpc_new_obj` | TinyPHP GC 管理 | 无需关心 |

**通用 C 指针自动注册**：`phpc_auto($ptr)` 把任意 C 指针注册到运行时，程序结束或异常时自动 `free`，适合不便于 `defer` 的场景。编译器对未配对 `defer`/`free` 的 `C.T*` transfer 指针输出 `[WARN]`（不阻断编译），识别 `*_free`/`*_destroy`/`*_release`/`*_close`/`*_delete` 等清理函数命名约定后告警消除。

> 完整所有权规则与安全 API 见 [PHPC 安全 API 与所有权](docs/phpc.md#safety)。

### 端到端示例 {#end-to-end}

以一个「向量运算」自定义 C 库为例，展示从 C 头文件 → C 实现 → tphp 声明 → tphp 调用的完整链路。

**1. C 头文件 `vec.h`**（`#include` 引入声明）：

```c
// vec.h
#pragma once

typedef struct {
    double x, y;
} Vec;

Vec*   vec_create(double x, double y);
double vec_dot(Vec* a, Vec* b);
void   vec_free(Vec* v);
```

**2. C 实现 `vec.c`**（命令行或 `#flag` 登记，一并编译链接）：

```c
// vec.c
#include "vec.h"
#include <stdlib.h>

Vec* vec_create(double x, double y) {
    Vec* v = malloc(sizeof(Vec));
    v->x = x;
    v->y = y;
    return v;
}

double vec_dot(Vec* a, Vec* b) {
    return a->x * b->x + a->y * b->y;
}

void vec_free(Vec* v) {
    free(v);
}
```

**3. tphp 声明 `main.php`**（`#include` 头文件 + `#flag` 登记 `.c` + `struct C.Vec {}` 声明字段布局）：

```php
<?php
#include __DIR__ . "/vec.h"          // 引入头文件声明
#flag __DIR__ . "/vec.c"             // 登记 C 源文件，自动加入编译

struct C.Vec {                       // 声明字段布局，启用 $v->x 原生访问
    C.double x;
    C.double y;
}

class Main {
    public function main(): void {
        C.Vec* $a = C->vec_create(3.0, 4.0);
        C.Vec* $b = C->vec_create(2.0, 1.0);
        defer C->vec_free($a);       // transfer 指针，退出自动释放
        defer C->vec_free($b);

        echo "a = (" . $a->x . ", " . $a->y . ")\n";   // 原生字段读
        float $dot = C->vec_dot($a, $b);                // 返回值须显式声明类型
        echo "dot = " . $dot . "\n";                    // 10
    }
}
```

**4. 编译运行**：

```bash
tphp main.php --debug
# a = (3, 4)
# dot = 10
```

此例完整覆盖了 `#include`（引入头文件）、`#flag`（登记 `.c` 源文件）、`struct C.Vec {}`（字段布局）、`C->func()`（C 调用）、`C.Type` 注解（`C.Vec*`/`C.double`）、`defer`（内存释放）六类机制的协作。

### 内置扩展清单 {#builtin-exts}

内置扩展分两层：`ext/` 按需引入（`#import`）与 `include/` 常驻编译（无需 `#import`）。错误契约：`zlib`/`zip`/`sqlite3`/`pdo` 等扩展错误统一抛 `Exception`（可 try-catch），不返回 `false`。

#### ext/ 按需扩展 {#ext-list}

<div class="tag-cloud">
    <span class="bny-tag" color="blue">pcntl</span>
    <span class="bny-tag" color="blue">posix</span>
    <span class="bny-tag" color="blue">pcre</span>
    <span class="bny-tag" color="blue">stream</span>
    <span class="bny-tag" color="blue">openssl</span>
    <span class="bny-tag" color="blue">curl</span>
    <span class="bny-tag" color="blue">sqlite3</span>
    <span class="bny-tag" color="blue">pdo</span>
    <span class="bny-tag" color="blue">pdo_mysql</span>
    <span class="bny-tag" color="blue">pdo_pgsql</span>
    <span class="bny-tag" color="blue">pgsql</span>
    <span class="bny-tag" color="blue">exif</span>
    <span class="bny-tag" color="blue">calendar</span>
    <span class="bny-tag" color="blue">fileinfo</span>
    <span class="bny-tag" color="blue">gd</span>
    <span class="bny-tag" color="blue">ui</span>
</div>

| 扩展 | 函数数 | 说明 |
|------|-------|------|
| `pcntl` | 7 | 进程控制（fork/wait/signal…），POSIX only |
| `posix` | 14 | POSIX 系统调用 |
| `pcre` | 8 | 正则引擎（自带 ReDoS 防护） |
| `stream` | 21 | socket stream |
| `openssl` | 21 | TLS/加密 |
| `curl` | 35 | HTTP 客户端（690 常量） |
| `sqlite3` | 11 | 函数式 SQLite |
| `pdo` | 33 | PDO 统一 API + SQLite 驱动 |
| `pdo_mysql` | 0 | MySQL 驱动（复用 PDO API） |
| `pdo_pgsql` | 3 | PostgreSQL PDO 驱动 |
| `pgsql` | 78 | PostgreSQL |
| `exif` | 8 | EXIF 图像元数据 |
| `calendar` | 16 | 日历转换 |
| `fileinfo` | 6 | MIME 类型检测 |
| `gd` | — | 图像处理 |
| `ui` | 9 类 + 9 枚举 | 图形界面，可编译 Android APK |

> `curl` 的 Multi/Share 句柄部分函数为 stub（见 [内置函数](docs/builtins.md)）。

**sqlite3（函数式 API）**：

```php
#import sqlite3

class Main {
    public function main(): void {
        int $db = sqlite_open(":memory:");
        sqlite_exec($db, "CREATE TABLE users(id INTEGER PRIMARY KEY, name TEXT)");
        sqlite_exec($db, "INSERT INTO users(name) VALUES('Alice')");
        echo sqlite_last_insert_rowid($db);            // 1
        $rows = sqlite_query($db, "SELECT * FROM users");
        var_dump($rows);                               // array<array<string>>
        sqlite_close($db);
    }
}
```

> 类型安全：数据库句柄以 `int` 存储（指针转 int）；查询结果统一 `array<array<string>>`；NULL 值返回空字符串。

**pdo（统一 API + SQLite 驱动）**：

```php
#import pdo

class Main {
    public function main(): void {
        $pdo = new PDO("sqlite::memory:");
        $pdo->exec("CREATE TABLE t(id INTEGER, name TEXT)");
        $stmt = $pdo->prepare("INSERT INTO t VALUES(?, ?)");
        $stmt->execute([1, "hello"]);
        foreach ($pdo->query("SELECT * FROM t") as $row) {
            var_dump($row);       // FETCH_ASSOC
        }
    }
}
```

> PDO 支持 SQLite / MySQL（`pdo_mysql`）/ PostgreSQL（`pdo_pgsql`）三种驱动；`bindValue`/`fetchColumn` 等按类型拆分（bindValueInt/bindValueStr）。

**curl（HTTP 客户端）**：

```php
#import stream
#import openssl
#import curl

class Main {
    public function main(): void {
        $ch = curl_init("http://httpbin.org/get");
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);
        curl_exec($ch);
        $body = curl_multi_getcontent($ch);
        $info = curl_getinfo($ch);
        echo "HTTP " . $info["http_code"] . ", " . strlen($body) . " bytes\n";
        curl_close($ch);
    }
}
```

#### include/ 常驻扩展 {#include-exts}

以下扩展随 C 运行时**常驻编译**，**无需 `#import`**：

<div class="tag-cloud">
    <span class="bny-tag" color="green">zlib</span>
    <span class="bny-tag" color="green">zip</span>
    <span class="bny-tag" color="green">filter</span>
    <span class="bny-tag" color="green">hash</span>
    <span class="bny-tag" color="green">iconv</span>
    <span class="bny-tag" color="green">mbstring</span>
    <span class="bny-tag" color="green">ctype</span>
    <span class="bny-tag" color="green">json</span>
    <span class="bny-tag" color="green">password</span>
    <span class="bny-tag" color="green">random</span>
</div>

| 扩展 | 函数数 | 说明 |
|------|-------|------|
| `zlib` | 29 | gzip/zlib/deflate 压缩 + 流式 + 增量上下文；依赖系统 zlib 库，自动检测链接 |
| `zip` | 18 | ZIP 归档读写 |
| `filter` | 3 | `filter_var` 验证/净化过滤器 |
| `hash` | 5 | md5/sha1/sha256/sha512/crc32 |
| `iconv` | 8 | 字符集转换 |
| `mbstring` | 3 | UTF-8 多字节字符串 |
| `ctype` | 11 | 字符检测 |
| `json` | 3 | json_encode/decode/validate |
| `password` | 2 | bcrypt 密码哈希 |
| `random` | 4 | CSPRNG 随机数 |

#### 第三方库链接 {#third-party}

未内置的第三方 C 库（如 `libcrypto`、`libcurl` 的自定义构建、自编译静态库等）通过 `#flag -l<name>` 链接、`#include` 引入头文件即可使用，无需打包为扩展：

```php
#include <openssl/evp.h>        // 第三方库头文件
#flag -lcrypto                  // 链接 libcrypto
#flag -L/usr/local/lib          // 库搜索路径（可选）
#flag -I/usr/local/include      // 头文件搜索路径（可选）

class Main {
    public function main(): void {
        C.EVP_MD_CTX* $ctx = C->EVP_MD_CTX_new();
        defer C->EVP_MD_CTX_free($ctx);
        // ... 调用 EVP API ...
    }
}
```

> 优先使用内置扩展：`openssl`/`curl`/`sqlite3` 等已作为 `ext/` 内置扩展提供 PHP 风格 API，仅在需要内置扩展未覆盖的底层 C 接口时才直接链接第三方库。

#### ui 图形扩展 {#ui}

跨平台图形界面扩展（`#import ui`）：

- **绘图**：App/Window/Graphics 2D 绘图
- **控件**：Button/Label/TextBox/CheckBox/Slider Widget 体系
- **布局**：Stack/CanvasLayout；事件系统 + 软键盘桥接
- **后端**：Windows/Linux → OpenGL，macOS → Metal，Android → GLES3
- **Android**：NDK 交叉编译打包 APK（`-os android`），含 JNI 软键盘、触摸事件转换、原生按键拦截

```bash
tphp test/ui/ui_basic.php -os android     # 编译 4 ABI → xxx-debug.apk
```
