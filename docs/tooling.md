## 工具链与测试 {#tooling}

本文集中讲解 tphp 的命令行选项、`#debug` 测试驱动、多文件项目组织、跨平台/Android 构建、`-shared` 动态库导出与 PHAR 分发。假设你已读过 [快速开始](docs/quickstart.md)。

### CLI 选项全集 {#cli}

| 选项 | 用途 |
|------|------|
| `-o <output>` | 指定输出文件路径。默认从入口文件名派生，并按目标平台追加扩展名（`.exe` / `.so` / `.dll` / `.dylib` / `-debug.apk`） |
| `-cc <compiler>` | 指定 C 编译器：`gcc` / `clang` / 交叉编译器路径。默认使用内置 TCC（亚秒编译）；切到 `gcc`/`clang` 可叠加 `-O2`，再快 3-10x |
| `-os <target>` | 目标系统：`windows` / `linux` / `macos` / `android`。未指定时取宿主系统，用于交叉编译 |
| `-arch <arch>` | 目标架构：`x86_64` / `aarch64` / `armv7a` / `i686`。Windows/Linux 默认 `x86_64`、macOS 默认 `aarch64`；Android 默认编译全部 4 种 ABI，可用本参数收敛到单一 ABI |
| `-shared` | 编译为动态库（`.dll` / `.so` / `.dylib`），配合 `#[Export]` 注解导出 C 函数符号（详见 [动态库导出](#shared)） |
| `--no-android-apk` | Android 模式下仅生成 `libtphp.so`，跳过 Gradle APK 打包（加速调试，或仅做原生库联调时使用） |
| `--debug` | 测试模式：打印编译命令 → 编译 → 运行产物 → 与源码中的 `#debug` 预期输出**逐行比对**（详见 [#debug 测试驱动](#debug)） |
| `-h, --help` | 显示帮助 |
| `-v, --version` | 显示版本 |

> 长参数形式同样支持：`--os=linux`、`--arch=x86_64`、`--debug`。文件参数顺序即编译合并顺序，入口文件必须含全局 `class Main`。

```bash
# 单文件，默认内置 TCC
tphp app.php

# 指定输出名 + 外部编译器（开启 -O2 优化）
tphp app.php -o app -cc gcc

# 跨平台交叉编译
tphp app.php -os linux -arch aarch64 -o app-linux-arm64
tphp app.php -os windows -o app.exe

# 测试模式：编译 + 运行 + 比对 #debug
tphp app.php --debug

# Android：仅产出 .so，不打包 APK（加速 CI）
tphp ui.php -os android --no-android-apk
```

### #debug 测试驱动 {#debug}

`#debug` 是写在源码注释位置的**预期输出声明**。配合 `--debug`，编译器会自动编译、运行产物，并将实际 stdout 与预期**逐行比对**，命中输出 `[YES]`，不匹配输出实际值并标记失败。

三种写法：

| 写法 | 含义 |
|------|------|
| `#debug text` | 期望该行输出为 `text`（精确匹配，含 `var_dump` 格式） |
| `#debug` | 期望该行为空行 |
| `#debug ~ text` | 近似匹配（用于时间/时区/随机等不稳定输出），仅以 `[REF]` 展示参考值，不判错 |

```php
<?php
#debug int(42)
#debug string(5) "hello"
#debug bool(true)
#debug
#debug ~ int(17xxxxxx)

class Main {
    public function main(): void {
        var_dump(42);
        var_dump("hello");
        var_dump(true);
        echo "\n";                 // 对应空行预期
        var_dump(time() % 100);    // 近似值，只展示不判错
    }
}
```

```bash
tphp test.php --debug
# [YES] int(42)
# [YES] string(5) "hello"
# [YES] bool(true)
# [YES]                      （空行）
# [REF] int(73)              （近似，不判错）
```

比对流程：`--debug` 先打印实际下发的 C 编译命令，再运行二进制，把 stdout 按行切分后与 `#debug` 声明**按出现顺序**一一比对。`#debug` 声明可置于源码任意位置（通常集中在文件头），数量与顺序需与实际输出对齐。

> CI 自动发现：`php .github/scripts/run_tests.php` 递归扫描 `test/` 下所有**含 `#debug` 且不含 `@skip`** 的文件，逐个 `--debug` 跑测。详见 [多文件编译](#multi-file) 的 `@skip`。

### 多文件编译 {#multi-file}

tphp 把多个 `.php` / `.c` 文件合并为单入口编译。入口文件必须含全局 `class Main`，辅助文件通过命令行显式列出或用 `@multi` 注解声明。

| 注解 | 位置 | 含义 |
|------|------|------|
| `// @multi @with x,y,...` | 入口文件 `<?php` 同行 | 声明多文件入口，按列出顺序合并编译辅助文件 |
| `// @skip` | 任意文件 `<?php` 同行 | CI/编译自动跳过该文件（OS 限定、需外部环境、无 `Main` 类的辅助文件） |

```php
// main.php —— 入口
<?php // @multi @with models.php,services.php
use MyApp\Models\User;
use MyApp\Services\OrderService;

class Main {
    public function main(): void {
        $u = new User(1, "alice");
        $svc = new OrderService($u);
        echo $svc->summary() . "\n";
    }
}
```

```php
// models.php —— 辅助文件（无 Main，加 @skip 防 CI 误跑）
<?php // @skip
namespace MyApp\Models;
class User {
    public function __construct(public int $id, public string $name) {}
}
```

```php
// services.php —— 辅助文件
<?php // @skip
namespace MyApp\Services;
use MyApp\Models\User;
class OrderService {
    public function __construct(private User $user) {}
    public function summary(): string { return "user=" . $this->user->name; }
}
```

```bash
# 三种等价入口
tphp main.php models.php services.php     # 显式列出辅助文件
tphp main.php                              # 依赖 @multi @with 自动拉取
tphp .                                     # 扫描当前目录全部 .php / .c
```

> `@multi @with` 路径相对入口文件所在目录；`@skip` 既阻止 CI 单文件跑测，也作为「无 Main 类」的辅助文件标记，避免被 `tphp .` 当成入口。

### 跨平台编译 {#cross-platform}

通过 `-os` / `-arch` 矩阵做交叉编译，宿主机无需安装目标平台工具链即可产出对应二进制（Android 需 NDK）。

| `-os` | `-arch` | 默认架构 | 产物 | 编译器 |
|-------|---------|----------|------|--------|
| `windows` | `x86_64` | x86_64 | `.exe` / `.dll` | TCC / GCC / Clang |
| `linux` | `x86_64`、`aarch64` | x86_64 | ELF / `.so` | TCC / GCC / Clang |
| `macos` | `aarch64` | aarch64 | Mach-O / `.dylib` | TCC / GCC / Clang |
| `android` | `aarch64`、`x86_64`、`armv7a`、`i686` | 全部 4 ABI | `libtphp.so` / `-debug.apk` | NDK Clang |

```bash
# 桌面交叉编译
tphp app.php -os linux                        # x86_64 Linux
tphp app.php -os linux -arch aarch64          # ARM64 Linux（树莓派 / 服务器）
tphp app.php -os macos                        # Apple Silicon macOS
tphp app.php -os windows -o app.exe           # Windows 可执行
```

#### Android APK 构建 {#android}

Android 目标用 NDK Clang 交叉编译为 `libtphp.so`，再经 Gradle 打包为 `-debug.apk`。需要以下环境变量：

| 变量 | 必需 | 说明 |
|------|:---:|------|
| `ANDROID_NDK` | 是 | NDK 根目录路径 |
| `JAVA_HOME` | APK 打包 | JDK 17/21 路径（Java 24+ 不兼容 Gradle 8.9） |
| `ANDROID_HOME` | APK 打包 | Android SDK 路径 |
| `TPHP_ANDROID_API` | 否 | 目标 API 级别，默认 24（Android 7.0） |

```bash
# Windows 示例
set ANDROID_NDK=C:\Android\ndk\27.0.12077973
set JAVA_HOME=C:\jdk-21
set ANDROID_HOME=C:\Android\sdk

# 默认编译全部 4 种 ABI，生成 <baseName>-debug.apk
tphp ui.php -os android

# 指定输出名 → myapp-debug.apk
tphp ui.php -os android -o myapp

# 仅模拟器 ABI，加速调试
tphp ui.php -os android -arch x86_64

# 仅产出 .so，跳过 APK 打包（CI 联调原生库）
tphp ui.php -os android --no-android-apk
```

> `ui` 扩展（`#import ui`）已适配 Android：GLES3 渲染、JNI 软键盘、触摸事件转换、原生按键拦截。桌面平台用 OpenGL（Win/Linux）/ Metal（macOS）。

### 动态库导出 {#shared}

`-shared` 把 `#[Export("name")]` 标记的独立函数导出为 C 符号，生成可被外部 C 代码 `dlopen`/`LoadLibrary` 调用的动态库。

```php
<?php
// 导出为 C 函数 add / greet
#[Export("add")]
function phpAdd(int $a, int $b): int { return $a + $b; }

#[Export("greet")]
function phpGreet(string $name): string { return "hi " . $name; }

// Main 类仍需存在（-shared 不豁免），但 main() 不会被执行
class Main {
    public function main(): void {}
}
```

```bash
tphp lib.php -shared -o mylib.dll     # Windows
tphp lib.php -shared -o mylib.so      # Linux
tphp lib.php -shared -o mylib.dylib   # macOS
```

```c
// 外部 C 调用方需包含运行时头
#include "tphp_runtime.h"
#include <stdio.h>

int main(void) {
    printf("%lld\n", add(10, 20));        // 30
    printf("%s\n", greet("world"));       // hi world
    return 0;
}
```

| 规则 | 说明 |
|------|------|
| 适用对象 | 仅独立函数（`function`）；用于方法报语法错误 |
| 类型约束 | 参数/返回值允许 `int` / `float` / `bool` / `string` / `void` / `C.Type`；**禁止 `array`** |
| string 映射 | 直接暴露 `t_string*`（不桥接 `char*`），C 侧需 `#include "tphp_runtime.h"` |
| 非 `-shared` 模式 | `#[Export]` 静默忽略，函数仍可被 PHP 侧正常调用 |
| 与用户注解共存 | `#[Export]` 与 `#[ROUTE(...)]` 等注解系统独立，可同时附着于同一函数 |

> `--debug` 模式下不对 `-shared` 产物做输出比对（动态库不可直接执行）。

### PHAR 分发 {#phar}

tphp 自身可用 PHAR 打包为单文件分发，目标机器无需安装 PHP 环境。

```bash
# 源码仓库内打包
php build.php                    # 产出 tphp.phar

# micro.sfx + phar 拼接为独立可执行
#   Windows: tphp.exe
#   Linux/macOS: 直接拼接为 tphp
./tphp main.php                  # 首次运行自动解压 include/ 与 tcc/ 到同级目录
```

| 分发形态 | 说明 |
|----------|------|
| `tphp.phar` | 单文件 PHAR，需宿主有 PHP 运行时 |
| `tphp` / `tphp.exe` | `micro.sfx` 自解压壳 + PHAR 拼接，**无需 PHP 环境**，首次运行解压 C 运行时与内置 TCC |
| GitHub Actions 产物 | `.github/workflows/build.yml` 自动构建四平台：Windows x86_64 / Linux x86_64 / Linux aarch64 / macOS aarch64 |

```bash
# 用户侧：从 Releases 下载对应平台单文件即可使用
tphp app.php --debug             # 开箱即用，include/ 与 tcc/ 首次自动解压
```

> 同样的打包思路可用于你自己的 tphp 项目：把入口 + 辅助文件 + `#flag` 声明的 C 源文件组织在同一目录，配合 CI 产出平台二进制分发。多文件入口推荐用 `@multi @with` 注解固化依赖关系（见 [多文件编译](#multi-file)）。
