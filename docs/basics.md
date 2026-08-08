## 语言基础 {#basics}

本章带你从零认识 tphp 的基本语法。即使你完全没接触过编程也不用担心——我们会用生活化的类比把每个概念讲清楚。

### 文件结构 {#file-structure}

一个 tphp 源代码文件就是一段纯文本，里面写的是程序逻辑。和某些语言可以混合 HTML 标签不同，tphp 文件里**只能写代码，不能塞 HTML 或其他游离内容**——所有语句都必须放在类和函数内部。

每个程序的入口固定是一个名为 `Main` 的类，里面必须有一个 `main()` 方法，程序从这里开始执行。你可以把 `Main` 类想象成一栋大楼的正门，`main()` 就是门后面的接待台，所有访客（程序运行）都从这里进门。

文件开头的 `<?php` 标签是**可选的**——写或不写都能编译。下面是一个最小可运行的程序：

```php
class Main
{
    public function main(): void
    {
        echo "hello world\n";
    }
}
```

把这段代码保存为 `hello.php`，编译运行：

```bash
tphp hello.php
./hello        # Linux/macOS
.\hello.exe    # Windows
```

屏幕上就会输出 `hello world`。几点说明：

- `class Main` 必须放在**全局命名空间**（也就是文件开头不要写 `namespace` 声明）。
- `public function main(): void` 是入口签名，`void` 表示它不返回任何值。
- `Main` 类还可以有 `__construct(int $argc, array $argv)` 用来接收命令行参数，以及 `__destruct()` 在程序退出前自动调用——这两个都是可选的。

### 语句与注释 {#statements-comments}

**语句**是程序执行的最小单位，就像一句话。在 tphp 里，每条语句以分号 `;` 结尾，表示"这句话说完了"。少了分号编译器会报错。

```php
class Main {
    public function main(): void {
        $name = "Tom";
        echo $name;
    }
}
```

**注释**是写给程序员看、编译器会忽略的文字，用来解释代码含义。tphp 支持两种注释：

```php
// 这是单行注释，从 // 到行末都被忽略

/* 这是多行注释，
   可以跨好几行，
   编译器完全跳过 */
```

> 特别提醒：以 `#` 开头的行**不是注释**，而是**编译指令**！比如 `#debug` 用来声明测试预期输出，`#include` 用来引入 C 头文件。把编译指令误当注释删掉，程序可能就跑不起来了。

```php
#debug int(42)        // 这是编译指令，不是注释
// 这才是真正的注释
```

### 输出 {#output}

`echo` 是把内容打印到屏幕上的最基本方式。你可以把它想象成"喊出来"——程序运行时把信息喊给你听。

**输出字符串**：

```php
class Main {
    public function main(): void {
        echo "hello\n";        // 输出：hello（\n 表示换行）
        echo 'world';          // 输出：world
    }
}
```

**输出变量**：

```php
class Main {
    public function main(): void {
        $name = "Tom";
        echo $name;            // 输出：Tom
        echo "\n";
    }
}
```

**拼接后输出**：用 `.` 把多段内容拼成一串再输出，就像用胶水把几段绳子接起来：

```php
class Main {
    public function main(): void {
        $name = "Tom";
        $age = 18;
        echo "我叫" . $name . "，今年" . $age . "岁\n";
        // 输出：我叫Tom，今年18岁
    }
}
```

`echo` 还支持一次输出多个值，用逗号分隔：

```php
class Main {
    public function main(): void {
        echo "a", "b", "c";    // 输出：abc
    }
}
```

### 变量 {#variables}

变量是用来存放数据的"盒子"。每个变量有一个名字，你可以往盒子里放东西（赋值），也可以看看盒子里是什么（读取）。

**命名规则**：

- 变量名以 `$` 符号开头，比如 `$name`、`$age`。
- `$` 后面跟字母、数字或下划线，但**数字不能开头**。`$age`、`$_count`、`$user2` 合法；`$2user` 非法。
- 变量名区分大小写：`$age` 和 `$Age` 是两个不同的变量。

```php
class Main {
    public function main(): void {
        $name = "Tom";          // 把 "Tom" 放进 $name 盒子
        $age = 18;
        $user_name = "Tom";     // 下划线分隔多个单词
        echo $name;
    }
}
```

**类型固定——这是 tphp 和动态语言最大的区别**。

在 Python、JavaScript 这类动态语言里，同一个变量可以先存数字、再存字符串，类型随便换。但 tphp 是 AOT 编译语言，**变量在第一次赋值时就确定了类型，之后不能再切换**。可以把它想象成：一旦你给这个盒子贴上了"装整数"的标签，它就永远只能装整数，往里塞字符串会报错。

```php
class Main {
    public function main(): void {
        $x = 10;          // 第一次赋值，$x 被确定为 int 类型
        echo $x;          // 正常：10

        // $x = "hi";     // 编译错误！$x 已经是 int，不能切换为 string
    }
}
```

这种"类型固定"的好处是：编译器在编译时就知道每个变量的类型，能生成更高效、更安全的机器码，运行时不需要反复检查类型。

### 基本类型与字面量 {#types-literals}

"字面量"就是直接写在代码里的值，比如 `42`、`"hi"`。tphp 有以下几种基本类型：

**int（整数）**：不带小数点的数字，可以是十进制、十六进制（`0x` 开头）、二进制（`0b` 开头）：

```php
class Main {
    public function main(): void {
        $decimal = 42;        // 十进制
        $hex = 0xFF;          // 十六进制，等于 255
        $binary = 0b101;      // 二进制，等于 5
    }
}
```

**float（浮点数）**：带小数点的数字，用来表示小数：

```php
class Main {
    public function main(): void {
        $pi = 3.14;
        $price = 9.99;
    }
}
```

**string（字符串）**：一段文本，可以用单引号或双引号包起来。两者的区别在于：双引号里可以用 `\n`（换行）、`\t`（制表符）等转义字符，也能直接插入变量；单引号里除 `\'` 和 `\\` 外，其他都按字面处理：

```php
class Main {
    public function main(): void {
        $name = "Tom";
        echo "hello $name";   // 输出：hello Tom（双引号里变量会被替换）
        echo 'hello $name';   // 输出：hello $name（单引号里 $name 是字面文本）
        echo "hi\n";          // 输出 hi 后换行（双引号解释 \n）
        echo 'hi\n';          // 输出 hi\n（单引号原样输出这两个字符）
    }
}
```

**bool（布尔）**：只有两个值——`true`（真）和 `false`（假），用来做条件判断：

```php
class Main {
    public function main(): void {
        $isOpen = true;
        $isEmpty = false;
    }
}
```

**array（数组）**：一个能装多个值的有序集合，用方括号 `[]` 表示。它既是列表又是映射——可以按数字顺序排，也可以用字符串当键：

```php
class Main {
    public function main(): void {
        $nums = [1, 2, 3];                          // 数字索引数组
        $person = ["name" => "Tom", "age" => 18];   // 字符串键映射
    }
}
```

### 常用运算符 {#operators}

运算符就是连接数据的符号，就像数学里的加减乘除。

**算术运算符**——做数学计算：

```php
class Main {
    public function main(): void {
        $a = 10 + 3;   // 13  加
        $b = 10 - 3;   // 7   减
        $c = 10 * 3;   // 30  乘
        $d = 10 / 3;   // 3.333... 除
        $e = 10 % 3;   // 1   取余数（10 除以 3 余 1）
    }
}
```

**比较运算符**——比较两个值的大小或是否相等，结果是 `true` 或 `false`：

```php
class Main {
    public function main(): void {
        $x = 5;
        $y = 10;
        $eq = ($x == $y);    // false，是否相等
        $ne = ($x != $y);    // true，是否不等
        $lt = ($x < $y);     // true，小于
        $gt = ($x > $y);     // false，大于
        $le = ($x <= 5);     // true，小于等于
        $ge = ($x >= 5);     // true，大于等于
    }
}
```

> 小贴士：因为 tphp 类型固定，`==` 和 `===` 效果一样——编译时类型已知，不存在"值相等但类型不同"的情况。

**逻辑运算符**——把多个条件组合起来，常用于 if 判断：

```php
class Main {
    public function main(): void {
        $sunny = true;
        $weekend = false;

        $a = ($sunny && $weekend);   // false，"且"：两边都真才真
        $b = ($sunny || $weekend);   // true，"或"：一边真就真
        $c = !$sunny;                // false，"非"：取反
    }
}
```

完整的 15 级运算符优先级（包括位运算、三元、空合并、太空船等）见 [语法特性](docs/syntax.md)。
