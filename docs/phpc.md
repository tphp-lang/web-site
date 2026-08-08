## C 互操作 PHPC {#phpc}

PHPC 是 TinyPHP 与 C 语言互操作的核心能力。通过编译期指令（`#include`/`#flag`）与 `C.Type` 类型注解，可直接调用 C 函数、读写 C 常量/结构体、双向传递数组/对象/回调。提供 40 个 PHPC 函数。

### #include 与 #flag 指令 {#include-flag}

支持按平台/编译器条件包含头文件与链接标志：

```php
#include "include/demo.h"
#include Linux "linux_only.h"
#include Windows <windows.h>
#include __DIR__ . "/../demo.h"        // 源文件目录向上
#include __EXT__ . "/demo/src/demo.h"  // ext/ 目录
#include __INC__ . "/common.h"         // include/ 目录
#include __CMD__ . "/local_lib.h"      // 当前工作目录（tphp . 时有用）
#include <math.h>                      // 系统头文件原样通过
#flag Linux -lm
#flag GCC -O2 -DNDEBUG
#flag Clang -Wall -Werror
```

`#include` 路径支持 PHP 魔术常量展开：

| 常量 | 展开为 | 示例 |
|------|--------|------|
| `__DIR__` | 源文件所在目录（绝对路径） | `__DIR__ . "/../demo.h"` |
| `__EXT__` | 编译器 `ext/` 目录 | `__EXT__ . "/pcntl/src/pcntl.h"` |
| `__INC__` | 编译器 `include/` 目录 | `__INC__ . "/common.h"` |
| `__CMD__` | 执行 `tphp` 的工作目录 | `__CMD__ . "/my_lib.h"` |
| `DIRECTORY_SEPARATOR` | `/` 或 `\` | 跨平台路径拼接 |

> 展开后校验路径需在项目根目录内（路径安全）；`#include "..."` 与 `#include <...>` 的原格式不受影响。

### C 类型注解 {#c-type}

借鉴 vlang 的 `C.Type` 命名空间设计，函数参数/返回值可直接写 C 类型，编译器自动映射：

```php
#include "my_func.h"

function make_point(): C.Point* {          // 返回 Point*（结构体指针）
    return C->point_create(1.0, 2.0);
}
function get_x(C.Point* $p): C.double {    // 参数 Point*、返回 double
    return C->point_get_x($p);
}
```

| C 类型注解 | 映射为 C 类型 | 说明 |
|-----------|--------------|------|
| `C.int` | `int` | C int |
| `C.int32` / `C.int64` | `int32_t` / `int64_t` | 固定宽度整数 |
| `C.uint32` / `C.uint64` | `uint32_t` / `uint64_t` | 无符号整数 |
| `C.float` / `C.double` | `double` | 浮点数 |
| `C.char` | `char` | 单字符 |
| `C.bool` | `bool` | 布尔值 |
| `C.void` | `void` | 无返回值 |
| `C.void*` | `void*` | 通用指针 |
| `C.char*` | `char*` | C 字符串指针 |
| `C.int*` / `C.double*` | `int*` / `double*` | 整数/浮点指针 |
| `C.XXX` | `XXX` | 结构体值类型 |
| `C.XXX*` | `XXX*` | 结构体指针（如 `C.Point*` → `Point*`） |

> `C.Type` 让 C 边界在函数签名中一目了然，编译器自动映射，无需手动 `c_int`/`php_int` 转换。

### 直接调用 C {#call-c}

使用 `C->function(args)` 调用 C 函数，使用 `C->CONST` 读取 C 常量/枚举/宏：

```php
#include "include/cconst.h"

class Main {
    public function main(): void {
        var_dump(C->COLOR_RED);              // C 枚举值 → int(0)
        var_dump(C->MAX_SIZE);               // C #define 宏 → int(1024)
        $total = C->COLOR_RED + C->COLOR_GREEN;  // 表达式中使用
    }
}
```

> ⚠️ `C->` 调用返回值赋给变量时必须**显式声明类型**；独立语句（如 `C->foo();`）不需要；表达式上下文用 cast 包装（如 `php_int(C->foo())`）。

### 类型桥接 {#type-bridge}

| 函数 | 返回 | 说明 |
|------|------|------|
| `c_int($x)` | `int32_t` | int → C int（值拷贝） |
| `c_str($s)` | `const char*` | string → C 字符串（**借用指针**，不可 free） |
| `php_int($v)` | `int` | C int → PHP int |
| `php_str($s)` | `string` | `const char*` → PHP string |
| `php_str_clone($s)` | `string` | 深拷贝语义，明确克隆 |
| `c_void_ptr` | `void*` | 指针透传 |

> `c_float` / `php_float` 已移除——float 直接传递即可。

**指针 ↔ 整数桥接**：让 C 指针以整数在 PHP 层流转（如数据库句柄、opaque handle）：

| 函数 | 方向 | 说明 |
|------|------|------|
| `phpc_ptr_to_int($ptr)` | `void*` → `int` | 指针转整数 |
| `phpc_int_to_ptr($v)` | `int` → `void*` | 整数转回指针（函数内部转回调用 C 库） |

```php
// 句柄以 int 存储，调用时转回指针
int $h = phpc_ptr_to_int(C->create_handle());
C->use_handle(phpc_int_to_ptr($h));
```

### 数组互操作 {#arr-interop}

**严格 C 风格**：`phpc_arr_int($arr)` 要求所有元素为 int，否则抛异常（可 try-catch）；`phpc_arr_dbl` 接受 int 或 float。

```php
// 模式：提取 → C 操作 → 回收
function sum_array(array $arr): int {
    C.int32_t* $data = phpc_arr_int($arr);            // → int32_t* (malloc, 自动注册)
    $result = C->sum_ints($data, c_int(count($arr))); // C 操作
    return php_int($result);
}

function join_strs(array $arr): string {
    C.char** $data = phpc_arr_str($arr);              // → char** (malloc, 不自动注册)
    defer phpc_free_str_arr($data, c_int(count($arr))); // 函数退出自动释放
    C.char* $r = C->join_strs($data, c_int(count($arr)));
    return php_str($r);
}
```

| PHP → C | 要求 | 返回 | 所有权 |
|---------|------|------|--------|
| `phpc_arr_int($arr)` | 全部 int | `int32_t*` (malloc) | 自动注册，无需释放 |
| `phpc_arr_dbl($arr)` | int / float | `double*` (malloc) | 自动注册，无需释放 |
| `phpc_arr_str($arr)` | 全部 string | `char**` (malloc，逐串分配) | **需 `defer phpc_free_str_arr`** |

| C → PHP | 说明 |
|---------|------|
| `phpc_new_arr_int(src, len)` | `int32_t[]` → PHP array |
| `phpc_new_arr_dbl(src, len)` | `double[]` → PHP array |
| `phpc_new_arr_str(src, len)` | `char*[]` → PHP array |
| `phpc_new_arr()` | 空数组 |

### 对象互操作 {#obj-interop}

`phpc_obj` 提取对象底层 C 结构体指针：

```php
class MyPoint { public float $x; public float $y; }

function obj_read_x(MyPoint $p): float {
    $ptr = phpc_obj($p);                  // → void*（借用）
    return C->read_field($ptr, c_int(16)); // offsetof(x)
}
```

| 函数 | 方向 | 说明 |
|------|------|------|
| `phpc_obj($obj)` | PHP→C | 提取底层 C 结构体指针（`void*`，**借用**，不可 free） |
| `phpc_new_obj(ptr, vtable)` | C→PHP | 包裹 C 指针为 PHP 对象（**接管**语义） |
| `phpc_unregister_obj($ptr)` | 双向 | 解除对象注册（C 库自行 free 时调用，防 double-free） |
| `phpc_obj_steal($ptr)` | PHP→C | 标记对象已分离，防 double-free |

### #cstruct 结构体布局 {#cstruct}

`#cstruct` 顶层指令声明 C 结构体字段布局，使 PHP 侧可对 C 结构体指针做**原生字段访问**（`$p->field`），无需编写 C getter/setter：

```php
#cstruct Point { C.double x; C.double y; }   // 声明字段布局

class Main {
    public function main(): void {
        C.Point* $p = C->point_create(1.0, 2.0);
        defer C->point_free($p);
        echo $p->x;          // 原生读
        $p->y = 3.0;         // 原生写
    }
}
```

> `#cstruct` 仅声明字段布局以启用字段访问，不替代 `#include` 引入的真实 C 定义。字段类型使用 `C.type` 注解（如 `C.double`/`C.int`/`C.char*`）。

### 回调互操作 {#callback-interop}

**有 env 回调** — `phpc_fn_i32` + `phpc_env`：

```php
class Main {
    public function main(): void {
        $square = function(int $x): int { return $x * $x; };
        $result = C->apply_closure(
            phpc_fn_i32($square),   // → int32_t(*)(int32_t, void*)
            phpc_env($square),      // → void*（env）
            c_int(5)
        );
        // C 侧: int64_t apply_closure(int32_t (*fn)(int32_t, void*), void* env, int32_t val)
    }
}
```

| 函数 | 返回类型 |
|------|---------|
| `phpc_fn_i32($cb)` | `int32_t(*)(int32_t, void*)` |
| `phpc_fn_i64($cb)` | `int64_t(*)(int64_t, void*)` |
| `phpc_fn_f64($cb)` | `double(*)(double, void*)` |
| `phpc_fn($cb)` / `phpc_env($cb)` | `void*`（通用） |
| `phpc_new_fn(func)` | C 函数指针 → 可调用对象 |
| `phpc_new_fn_env(func, env)` | 带环境版本 |

**无 env 回调** — `#callback` 声明签名 + `phpc_thunk()`（支持任意签名）：

```php
#callback double fold_cb(int32_t idx, double val)  // 声明 C 回调签名（顶层指令）

class Main {
    public function main(): void {
        C->fold_dbl($data, $len, phpc_thunk('fold_cb', $fn));  // 按签名调用
    }
}
```

### 安全 API 与所有权 {#safety}

所有 PHPC 函数按所有权分三类，**搞错会导致 double-free 或内存泄漏**：

| API | 作用 | 防护对象 |
|-----|------|---------|
| `defer C->free($p)` / `defer C->fclose($f)` | 退出时自动释放 | 资源泄漏（**首选**） |
| `defer phpc_free_str_arr($a, $n)` | 字符串数组释放 | 资源泄漏 |
| `phpc_free($var)` | 显式释放 + 自动置零变量 | use-after-free |
| `phpc_assert_ptr($ptr, $name)` | NULL 断言，失败抛异常（可 try-catch） | NULL 解引用 |
| `phpc_obj_steal($obj)` | 标记对象已分离 | double-free |
| `phpc_env_pin($cb)` / `phpc_env_unpin($env)` | 钉住闭包 env，防异步回调 UAF | 异步回调 UAF |

**PHP → C（调用方负责释放）**：

| 函数 | 所有权 |
|------|--------|
| `c_int($x)` / `c_str($s)` | 值拷贝 / **借用指针** ❌ 不可 free |
| `phpc_arr_int/dbl($arr)` | malloc ✅ 自动注册，无需 `phpc_free`（循环内避免堆积可手动释放） |
| `phpc_arr_str($arr)` | malloc ⚠️ 不自动注册，用 `defer phpc_free_str_arr()` 释放 |
| `phpc_obj($obj)` / `phpc_fn($cb)` / `phpc_env($cb)` | **借用** ❌ 不可 free |
| `C->malloc(...)` / C 库返回的 `T*` | **transfer** — 用 `defer C->free($p)` 释放 |

**C → PHP（TinyPHP 自动管理）**：`phpc_new_arr_*` 与 `phpc_new_obj` 的产物归运行时管理，TinyPHP GC 自动回收。

**通用 C 指针自动注册**：`phpc_auto($ptr)` 将任意 C 指针注册到运行时，程序结束或异常时自动 `free`，无需手动 `phpc_free`（适合不便于 `defer` 的场景，如循环外申请、跨函数流转的指针）：

```php
C.void* $buf = phpc_auto(C->malloc(1024));   // 自动注册，程序结束/异常自动 free
// 即使忘记 defer，也不会泄漏
```

> `phpc_auto` 与 `phpc_arr_int/dbl` 的自动释放行为一致；`phpc_free` 会先注销注册防 double-free 再释放并自动置零变量。

**C 指针泄漏编译期提醒**：当 `C.T*` transfer 指针（C 库返回的 `malloc`/`new` 产物）未配对 `defer`/`free` 时，编译器输出 `[WARN]` 到 stderr（**不阻断编译**）。识别 `*_free`/`*_destroy`/`*_release`/`*_close`/`*_delete` 等清理函数命名约定，命中即视为已释放不再告警。

```php
C.Point* $p = C->point_create(1.0, 2.0);   // [WARN] transfer 指针未释放
defer C->point_free($p);                    // 配对后告警消除
```

### 错误处理 {#errors}

`phpc_arr_*` 类型不匹配抛异常，可被 `try-catch` 捕获：

```php
class Main {
    public function main(): void {
        try {
            $data = phpc_arr_int([1, "two", 3]);   // 元素 "two" 不是 int
        } catch (\Throwable $e) {
            echo "Caught: " . $e->getMessage();
        }
    }
}
```

> ⚠️ `C->func()` 段错误**不可恢复**，仍会导致进程崩溃。C 函数返回 NULL/错误码时需调用方手动检查，无统一约定。

### 完整示例 {#full-example}

自定义 C 库需要两个文件：头文件 `my_lib.h`（`#include` 引入声明）与源文件 `my_lib.c`（`#flag` 声明，自动加入编译）：

```c
// my_lib.h —— #include 引入头文件
typedef struct { double x, y; } Point;
Point* point_create(double x, double y);
double point_get_x(Point* p);
void point_free(Point* p);
```

```c
// my_lib.c —— 命令行传入，一并编译链接
#include "my_lib.h"
#include <stdlib.h>
Point* point_create(double x, double y) { Point* p = malloc(sizeof(Point)); p->x = x; p->y = y; return p; }
double point_get_x(Point* p) { return p->x; }
void point_free(Point* p) { free(p); }
```

```php
#include __DIR__ . "/my_lib.h"   // #include 只引头文件
#flag __DIR__ . "/my_lib.c"      // #flag 声明 C 源文件，自动加入编译

class Main {
    public function main(): void {
        C.Point* $p = C->point_create(3.0, 4.0);   // C 类型注解 + 结构体指针
        defer C->point_free($p);                    // 退出自动释放（transfer 所有权）

        float $x = C->point_get_x($p);              // 返回值赋变量必须显式声明类型
        echo $x, "\n";                              // 3
    }
}
```

```bash
tphp main.php --debug
```
