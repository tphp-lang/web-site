## 快速开始 {#quickstart}

本页是动手实操指南——安装、编译、跑起第一个程序。如果还不了解 tphp 是什么、为什么用它，先读 [认识 tphp](docs/intro.md)。

性能宣传语「提升 300-500 倍」是整体量级口径；[BENCHMARK_RESULTS.md](https://github.com/KingBes/TinyPHP/blob/main/BENCHMARK_RESULTS.md) 的实测数据（GCC -O2 下）：`foreach` 快 **26.6x**、`count+for` 快 **34-36.8x**、int 键读取快 **18.2x**、嵌套数组读 **22.9x**、方法调用接近 **0ns**。注意 TCC 默认编译（未优化）下 `create`/`array_push`/`array_merge` 仍慢于 PHP，追求性能请用 `-cc gcc`。

### 安装与下载 {#install}

推荐使用 GitHub Actions 自动构建的**单文件 PHAR**（无需 PHP 环境）：

```bash
# 从 Releases 下载对应平台的单文件（Linux/macOS 为 tphp，Windows 为 tphp.exe）
tphp main.php    # include/ 与 tcc/ 首次运行自动解压到同级目录
```

从源码构建则使用仓库自带的 PHP 运行时：

```bash
php tphp.php test/main/min.php
./min          # Linux/macOS
.\min.exe      # Windows
```

> 支持平台：Windows x86_64、Linux x86_64/aarch64、macOS aarch64、Android（4 种 ABI）。编译器：内置 TCC（默认，亚秒编译）、GCC、Clang。

### 第一个程序 {#hello-world}

每个程序需要一个**全局命名空间**（无 `namespace` 声明）的 `class Main`：

```php
<?php // <?php 标签可选

class Main
{
    // 入口函数 — 必须为 public function main(): void
    public function main(): void
    {
        echo "hello world\n";
    }
}
```

| 方法 | 签名 | 必须 | 说明 |
|------|------|------|------|
| `__construct` | `(int $argc, array $argv)` | 否 | 接收命令行参数；可省略 |
| `main` | `(): void` | **是** | 程序入口，必须强类型声明 |
| `__destruct` | `()` | 否 | 退出前自动调用，可省略 |

编译运行：

```bash
tphp main.php
./main
```

### 编译 {#compile}

| 命令 | 说明 |
|------|------|
| `tphp test/var/var.php` | 编译单文件，产物为同目录同名二进制 |
| `tphp main.php demo.php` | 多文件按入口顺序合并编译，被依赖文件需显式列出 |
| `tphp .` | 编译整个当前目录的 php 文件（`.` 表示当前目录） |
| `tphp main.php --debug` | 编译 + 运行 + 比对 `#debug` 预期输出 |
| `tphp main.php -cc gcc` | 指定外部编译器（gcc/clang）替代内置 TCC |

#### 多文件编译注解 {#multi-annotation}

多文件入口推荐用 `@multi` 注解声明（辅助文件用 `@skip` 标记）：

```php
// main.php
<?php // @multi @with models.php,services.php
use MyApp\Models\User;
// ...
```

| 注解 | 位置 | 含义 |
|------|------|------|
| `// @skip` | `<?php` 同行 | 编译/CI 自动跳过该文件（如 OS 限定、需外部环境） |
| `// @multi @with x,y` | `<?php` 同行 | 声明多文件入口，按顺序合并编译 |

### CLI 选项 {#cli-options}

<ul class="cli-options">
    <li><span class="bny-tag" color="blue">-o &lt;output&gt;</span> <span>输出文件路径（默认派生自入口文件名）</span></li>
    <li><span class="bny-tag" color="blue">-cc &lt;compiler&gt;</span> <span>指定 C 编译器：gcc / clang / 交叉编译器（默认内置 TCC）</span></li>
    <li><span class="bny-tag" color="green">-os &lt;target&gt;</span> <span>目标系统：windows / linux / macos / android</span></li>
    <li><span class="bny-tag" color="green">-arch &lt;arch&gt;</span> <span>目标架构：x86_64 / aarch64 / armv7a / i686</span></li>
    <li><span class="bny-tag" color="yellow">-shared</span> <span>编译为动态库（配合 #[Export] 注解）</span></li>
    <li><span class="bny-tag" color="yellow">--no-android-apk</span> <span>Android 模式仅编译 .so，跳过 APK 打包</span></li>
    <li><span class="bny-tag" color="red">--debug</span> <span>编译运行并比对 <code>#debug</code> 预期输出</span></li>
    <li><span class="bny-tag">-h / --help</span> <span>显示帮助；<code>-v / --version</code> 显示版本</span></li>
</ul>

> 也支持长参数形式 `--os=linux`、`--arch=x86_64`。

### #debug 测试驱动 {#debug-test}

使用 `#debug` 注释声明预期输出，配合 `--debug` 自动比对：

```php
<?php
#debug int(42)
#debug string(5) "hello"

class Main {
    public function main(): void {
        var_dump(42);
        var_dump("hello");
    }
}
```

```bash
tphp test.php --debug   # [YES] 逐行比对通过
```

> `#debug text` 预期该行输出为 `text`（精确匹配）<br>
> `#debug` 预期该行为空行<br>
> `#debug ~ text` 预期近似值（如时间/时区相关），`[REF]` 只展示不判错

### 调用 C 函数（PHPC） {#call-c-demo}

写一个 C 源文件 `my_func.c` 与头文件 `my_func.h`，在 PHP 中用 `#include` 引头文件、`#flag` 声明源文件：

```c
// my_func.h
int my_add(int a, int b);
```

```c
// my_func.c
#include "my_func.h"
int my_add(int a, int b) { return a + b; }
```

```php
<?php
#include __DIR__ . "/my_func.h"    // 引入 C 头文件
#flag __DIR__ . "/my_func.c"       // 声明 C 源文件，自动加入编译

#debug int(30)

class Main {
    public function main(): void {
        // C-> 调用返回值赋给变量时必须显式声明类型（AOT 类型安全）
        int $r = C->my_add(c_int(10), c_int(20));
        var_dump($r);
    }
}
```

```bash
tphp main.php --debug
# [YES] int(30)
```

> `#include` 只用于引入 C 头文件；`.c` 源文件统一由 `#flag` 指令声明（如 `#flag __DIR__ . "/my_func.c"`），编译器自动加入编译列表。

> 完整 C 类型注解（`C.int`/`C.void*`/`C.Point*`）、数组/对象/回调互操作与安全 API 见 [C 互操作 PHPC](docs/phpc.md)。

### 多线程 {#threads-demo}

内置 `Thread`/`Mutex`/`CondVar`/`WaitGroup` 四类线程原语：

```php
<?php
class Main {
    public function main(): void {
        $t = new Thread(function(): int { return 42; });
        $t->start();
        echo "ret=" . $t->join() . "\n";   // ret=42

        $wg = new WaitGroup();
        $wg->add(1);
        $t2 = new Thread(function() use ($wg): int {
            $wg->done();
            return 0;
        });
        $t2->start();
        $wg->wait();
        $t2->join();
        echo "sync=1\n";
    }
}
```

### 异步与协程 {#async-demo}

`Channel`/`Future`/`chan_select` 提供 CSP 风格异步通信：

```php
<?php
class Main {
    public function main(): void {
        // Channel 跨线程通信
        $ch = new Channel(4);
        $producer = new Thread(function() use ($ch): int {
            $ch->push("hello");
            return 0;
        });
        $producer->start();
        echo "cross=" . $ch->pop() . "\n";   // cross=hello
        $producer->join();

        // Future 链式回调
        $f = Future::create();
        $f->resolve(10);
        $doubled = $f->then(fn(mixed $x): mixed => $x * 2);
        echo "then=" . $doubled->await() . "\n";   // then=20

        // chan_select 多路复用：返回就绪索引
        $ch1 = new Channel(4);
        $ch2 = new Channel(4);
        $ch2->push("ready");
        echo "idx=" . chan_select([$ch1, $ch2], 100) . "\n";   // idx=1
    }
}
```

> 详细 API 见 [多线程与异步](docs/threads.md)。

### Android 构建 {#android}

```bash
# 环境变量：ANDROID_NDK（必需）、JAVA_HOME/JAVA17/21（APK 必需）、ANDROID_HOME、TPHP_ANDROID_API（默认 24）
tphp test/ui/ui_basic.php -os android          # 编译全部 4 种 ABI，生成 xxx-debug.apk
tphp test/ui/ui_basic.php -os android -arch x86_64   # 仅模拟器 ABI（加速调试）
```

### 常见问题 {#faq}

**Q: TCC 编译通过但 GCC/Clang 报错？**

A: TCC 不报隐式声明而 GCC/Clang 会。发布前用 `-cc gcc` 或 `-cc clang` 额外验证一遍。

**Q: 返回值赋给变量为什么要写类型？**

A: AOT 编译期需要确定类型。`C->` 调用或表达式上下文返回值赋给变量时必须显式声明类型，独立语句（如 `C->foo();`）不需要。
