## 快速开始 {#quickstart}

TinyPHP 是一个 PHP → C AOT 编译器，用 PHP 8.5 强类型语法编写原生二进制，零运行时依赖，性能提升 300-500 倍。下载源码后即可通过 `tphp.php` 入口编译 PHP 文件为可执行二进制。

### 编译单文件 {#compile-single}

```bash
tphp test/var/var.php
```

### 编译多文件 {#compile-multi}

多文件按入口顺序合并编译，被依赖文件需显式列出：

```bash
tphp main.php demo.php
```

### 编译整个目录

会获取整个当前目录的php文件，`.`点表示即可：

```bash
tphp .
```

### CLI 选项 {#cli-options}

常用命令行选项：

<ul class="cli-options">
    <li><span class="bny-tag" color="blue">-o &lt;output&gt;</span> <span>输出文件路径</span></li>
    <li><span class="bny-tag" color="blue">-cc &lt;compiler&gt;</span> <span>指定 C 编译器（默认内置 TCC）</span></li>
    <li><span class="bny-tag" color="green">-os &lt;target&gt;</span> <span>跨编译目标：windows / linux / macos</span></li>
    <li><span class="bny-tag" color="green">-arch &lt;arch&gt;</span> <span>目标架构：x86_64 / aarch64</span></li>
    <li><span class="bny-tag" color="yellow">-shared</span> <span>编译为动态库</span></li>
    <li><span class="bny-tag" color="red">--debug</span> <span>编译运行并比对 <code>#debug</code> 预期输出</span></li>
</ul>

### 第一个程序 Hello World {#hello-world}

每个程序需要一个 `Main` 类与 `main()` 入口方法：

```php
<?php // <?php 标签 可选

class Main
{
    // 构造函数 — 接收命令行参数（可选，默认可省略）
    public function __construct(int $argc, array $argv)
    {
        // $argc — 参数个数，$argv — 参数数组
    }

    // 入口函数 — 必须为 public function main(): void
    public function main(): void
    {
        echo "hello world\n";
    }

    // 析构函数 — 程序退出前自动调用（可选）
    public function __destruct() {}
}
```

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

运行比对：

```bash
tphp test.php --debug
```

> `#debug text` 预期该行输出为 `text`（精确匹配）<br>
> `#debug` 预期该行为空行<br>
> `#debug ~ text` 预期近似值（如时间/时区相关），`[REF]` 只展示不判错
