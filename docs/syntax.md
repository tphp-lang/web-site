## 语法特性 {#syntax}

> 基于 PHP 8.5 强类型语法，约 80% PHP 兼容性。下列特性均已在 AOT 编译器中实现。<br>
> 脚本标签 `<?php ?>` 可选, 无游离代码。 <br>
> 注释 `//` `/* */` 支持。

### tphp 不支持 {#unsupported}

（AOT 物理不可行）

| 特性 | 原因 | 代替方案 |
| ---- | ---- | ---- |
| `eval()` | 没有运行时解释器 | `switch`/`match` 分支调度，或回调分发 |
| `$$var` 可变变量 | 编译时不知道变量名 | `array` 映射：`$map[$key]` 替代 `$$key` |
| `include/require` | 没有运行时文件加载 | `#include` 引入 C 头文件，或多文件编译 |
| `__call` `__get` `__set` | 没有运行时分发 | 显式定义方法，或用 `switch` 在单个方法内分发 |
| `$obj->{$method}()` | 编译时不知道方法名 | 回调 map：`$fn = $map[$name]; $fn($args);` |

（不做 权衡决定）

| 特性 | 原因 | 代替方案 |
| ---- | ---- | ---- |
| `?int` 可空类型 | AOT 下 null 分支需要运行时分发 | 用 `mixed` 替代，或拆分为两个重载函数 |
| `callable $fn = "func"` 默认值 | 编译时无法将字符串函数名转换为函数指针 | 每次调用时显式传入闭包 |

### 基本的 tPHP 语法 {#basic-syntax}

php 文件默认文件拓展名是`.php`。
php 文件不能含有 HTML 标签和游离代码。
每个程序需要一个 `Main` 类与 `main()` 入口方法：

```php
<?php // <?php 标签 可选

// echo "hello world\n"; 不接受游离代码

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

### tphp 中的注释 {#php-comments}

无`#`注释，`#`另有用途。

1. 单行注释 `//`
2. 多行注释 `/* */`
3. 文档注释 `/** */`