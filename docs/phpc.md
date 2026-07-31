## C 互操作 PHPC {#phpc}

PHPC 是 TinyPHP 与 C 语言互操作的核心能力。通过编译期指令与类型注解，可直接调用 C 函数、操作 C 指针与结构体。

### #include 与 #flag 指令 {#include-flag}

支持按平台条件包含头文件与链接标志：

```php
#include "include/demo.h"
#include Linux "linux_only.h"
#include Windows <windows.h>
#flag Linux -lm
#flag GCC -O2 -DNDEBUG
```

### C 类型注解 {#c-type}

使用 `C.T*` 表示 C 指针类型，`C.<type>` 表示 C 标量类型：

```php
function create_origin(): C.Point* {
    return C->point_origin();
}
function get_point_x(C.Point* $p): C.double {
    return C->point_get_x($p);
}
```

### 直接调用 C {#call-c}

使用 `C->function(args)` 调用 C 函数，使用 `C->CONST` 读取 C 常量。

### 数组互操作 {#arr-interop}

PHP 数组转换为 C 数组的桥接函数：

- `phpc_arr_int($arr)` — int 数组
- `phpc_arr_dbl($arr)` — double 数组
- `phpc_arr_str($arr)` — string 数组

### 对象与回调互操作 {#obj-callback}

- `phpc_obj($obj)` / `phpc_new_obj` — 对象互操作
- `phpc_fn_i32($cb)` / `phpc_env($cb)` — 回调互操作

> **所有权规则：** `phpc_arr_int/dbl` 自动注册；`phpc_arr_str` 需 `defer phpc_free_str_arr`；`c_str/phpc_obj` 借用不可 free；C 库返回的 `T*` 用 `defer C->free` 释放。
