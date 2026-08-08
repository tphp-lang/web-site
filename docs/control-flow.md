## 控制流 {#control-flow}

> tphp 完整支持 PHP 8.5 的控制流构造：`if/elseif/else`、`while/do-while`、`for`、`foreach`、`switch`（含字符串 switch 与 fall-through）、`match`、`break N`、`continue N`、`goto`。语义与 PHP 一致，编译为原生 C 控制流，零运行时开销。
>
> 下文示例默认位于 `class Main` 的 `main(): void` 或顶层函数体内，假设读者已了解 [类型系统](docs/syntax.md#type-system)（类型固定、`array` 为有序映射）。

### 条件分支 {#if}

`if`/`elseif`/`else` 与 PHP 语法一致，条件表达式必须为 `bool`（其他类型按假值规则转换）：

```php
class Main {
    public function main(): void {
        int $score = 85;

        if ($score >= 90) {
            echo "A\n";
        } elseif ($score >= 80) {
            echo "B\n";
        } elseif ($score >= 60) {
            echo "C\n";
        } else {
            echo "F\n";
        }
    }
}
```

**三元运算符 `?:`**：`cond ? a : b` 取值；`a ?: b`（Elvis）当 `a` 为真值时返回 `a`，否则返回 `b`：

```php
int $age = 20;
string $label = $age >= 18 ? "adult" : "minor";   // "adult"

string $name = "";
string $display = $name ?: "anonymous";            // "anonymous"
```

**空合并 `??`**：左操作数为 `null` 时返回右操作数。对数组键 `$arr["k"] ?? $d` 编译为 `array_key_exists` 检查——键不存在（而非值为假）时才取默认值，这与 `?:` 的假值判定不同：

```php
array<string> $cfg = ["host" => "127.0.0.1"];

// 键存在，取 "127.0.0.1"
string $host = $cfg["host"] ?? "localhost";

// 键 "port" 不存在，取默认 8080
int $port = $cfg["port"] ?? 8080;

// 注意区别：?: 判假值，?? 判 null/键不存在
int $v = 0;
int $a = $v ?? 99;   // 0（0 不是 null）
int $b = $v ?: 99;   // 99（0 为假值）
```

> tphp 不支持 `?int` 可空类型，`null` 只能存在于 `mixed` 中。`??` 最常见的用途是数组键默认值与 `mixed` 变量的 null 兜底。`??=` 空合并赋值未实现，可用 `$a = $a ?? $b;` 展开替代。

### while 循环 {#while}

`while` 在每次迭代前求值条件；`do-while` 先执行循环体再求值条件（至少执行一次）：

```php
class Main {
    public function main(): void {
        // while：先判断后执行
        int $i = 0;
        while ($i < 3) {
            echo $i;           // 0 1 2
            $i++;
        }

        // do-while：先执行后判断，循环体至少跑一次
        int $n = 5;
        do {
            echo $n;           // 5
            $n--;
        } while ($n > 10);     // 条件为假，但已执行一次
    }
}
```

> `do ... while (...);` 末尾的分号不可省略。

### for 循环 {#for}

`for (init; cond; update)` 三段用分号分隔，每段可为空或包含多个逗号分隔的表达式：

```php
class Main {
    public function main(): void {
        // 经典计数循环
        int $sum = 0;
        for (int $i = 1; $i <= 100; $i++) {
            $sum += $i;
        }
        echo $sum;             // 5050

        // 多变量：逗号分隔
        for (int $i = 0, int $j = 10; $i < $j; $i++, $j--) {
            echo "{$i},{$j} "; // 0,10 1,9 2,8 3,7 4,6
        }
    }
}
```

> `for` 的三段均可省略（如 `for (;;) {}` 为无限循环），但两个分号必须保留。跳出无限循环请用 `break` 或 `goto`。

### foreach 遍历 {#foreach}

`foreach` 用于遍历数组（也支持 `Generator`，见 [闭包与 Generator](docs/syntax.md#closure-generator)）。tphp 的 `array` 是**有序映射**——元素按插入顺序排列，键可为 `int` 或 `string`，`foreach` 严格按此顺序迭代。

两种形式：

```php
class Main {
    public function main(): void {
        array<string> $names = ["alice", "bob", "carol"];

        // 形式一：as $value — 只取值
        foreach ($names as $name) {
            echo $name . " ";  // alice bob carol
        }

        // 形式二：as $key => $value — 同时取键和值
        array<int> $ages = ["alice" => 30, "bob" => 25, "carol" => 28];
        foreach ($ages as $key => $value) {
            echo "{$key}:{$value} ";  // alice:30 bob:25 carol:28
        }
    }
}
```

| 形式 | 语法 | 说明 |
|------|------|------|
| 只取值 | `foreach ($arr as $v)` | 按插入顺序取每个元素的值 |
| 键值对 | `foreach ($arr as $k => $v)` | `$k` 为键（int/string），`$v` 为值 |
| 引用值 | `foreach ($arr as &$v)` | 修改原数组元素（语法接受） |

> **有序映射语义**：`["a" => 1, "b" => 2]` 与 `[0 => 1, 1 => 2]` 在 `foreach` 中都按声明顺序输出，不存在 PHP 旧版中 int 键重排的隐患。tphp 不支持 `Iterator`/`IteratorAggregate` 接口的 `foreach`（需运行时动态分发），`foreach` 仅作用于 `array` 和 `Generator`。

### switch 分支 {#switch}

`switch` 对一个值进行多路分支，支持 `int`、`bool` 和 `string` 比较。**fall-through 语义**：某个 `case` 匹配后，从该 case 体开始执行，若未遇到 `break`，执行流会**穿透到下一个 case** 继续执行，直到遇到 `break` 或 `switch` 结束。

```php
class Main {
    public function main(): void {
        string $cmd = "start";

        // 字符串 switch：完全支持
        switch ($cmd) {
            case "start":
                echo "run\n";
                break;             // 不写 break 会穿透到下一个 case
            case "stop":
                echo "halt\n";
                break;
            case "pause":
            case "resume":         // 多个 case 共享同一段代码（显式 fall-through）
                echo "toggle\n";
                break;
            default:
                echo "unknown\n";
        }
    }
}
```

**fall-through 示例**（不写 `break` 的后果）：

```php
int $x = 1;
switch ($x) {
    case 1:
        echo "one ";   // 匹配，输出 "one "
                       // 无 break，穿透到 case 2
    case 2:
        echo "two ";   // 继续输出 "two "
        break;         // 到此停止
}
// 输出：one two
```

> **字符串 switch 的实现**：C 原生 `switch` 不支持字符串，tphp 通过 `if-goto` 标签链实现字符串 switch，但**保留与 int/bool switch 一致的 fall-through 行为**。比较使用严格相等（tphp 中 `===` 与 `==` 等价，编译期已知类型）。
>
> 显式共享代码（多个 `case` 叠加）是 fall-through 的常见正当用法；意外遗漏 `break` 则是经典 bug，建议每个独立分支显式书写 `break`。

### match 表达式 {#match}

`match` 是**表达式**，有返回值，可出现在赋值右侧或任意表达式位置。它对候选值做严格相等比较（无 fall-through，仅匹配一个分支），支持多条件合并、`default` 兜底：

```php
class Main {
    public function main(): void {
        int $x = 2;

        // 基本用法：每个 arm 用 => 返回一个值
        string $name = match ($x) {
            1 => "one",
            2 => "two",
            3 => "three",
            default => "?",
        };
        echo $name;                 // two

        // 多条件合并：逗号分隔，任一匹配即返回该 arm 的值
        string $type = match ($x) {
            0, 1, 2 => "low",
            3, 4, 5 => "mid",
            default => "high",
        };
        echo $type;                 // low
    }
}
```

`match` 作为表达式可直接用于更复杂的场景：

```php
// 在表达式中内联使用
int $code = 404;
string $msg = "HTTP " . match ($code) {
    200 => "OK",
    404 => "Not Found",
    500 => "Server Error",
    default => "Unknown",
};
```

| 特性 | `switch` | `match` |
|------|----------|---------|
| 性质 | 语句 | 表达式（有返回值） |
| 比较 | `==` 语义（松散，tphp 下等价 `===`） | 严格相等 |
| fall-through | 有（不 `break` 穿透） | 无（仅匹配一个 arm） |
| default | `default:` | `default =>` |
| 多条件 | 多个 `case` 叠加 | `1, 2, 3 =>` 逗号分隔 |
| 无匹配且无 default | 继续 switch 后语句 | 抛出未匹配异常 |

> `match` 末尾的最后一个 arm 后逗号可选（与函数调用尾逗号规则一致）。无匹配且无 `default` 时，tphp 抛出 `UnhandledMatchError`（`Exception` 子类），可被 `try/catch` 捕获。

### 跳转控制 {#jump}

#### break N

`break` 跳出当前循环或 `switch`；带参数 `break N` 一次跳出 N 层嵌套结构：

```php
class Main {
    public function main(): void {
        // break 1（等同 break）：跳出内层循环
        for (int $i = 0; $i < 3; $i++) {
            for (int $j = 0; $j < 3; $j++) {
                if ($j === 1) {
                    break;          // 仅跳出内层，外层继续
                }
                echo "{$i}{$j} ";   // 00 10 20
            }
        }

        // break 2：一次跳出两层
        for (int $i = 0; $i < 3; $i++) {
            for (int $j = 0; $j < 3; $j++) {
                if ($i === 1 && $j === 1) {
                    break 2;        // 直接跳出两层循环
                }
            }
        }
    }
}
```

#### continue N

`continue` 跳过当前迭代剩余部分，进入下一次迭代；`continue N` 作用于外层第 N 层循环。注意 `continue` 对 `switch` 有特殊语义（PHP 中 `switch` 被视为循环的一层用于 `continue` 目的）：

```php
// continue 1：跳过内层当前迭代
for (int $i = 0; $i < 3; $i++) {
    for (int $j = 0; $j < 3; $j++) {
        if ($j === 1) {
            continue;              // 跳过 j=1，内层继续
        }
        echo "{$i}{$j} ";          // 00 02 10 12 20 22
    }
}

// continue 2：跳到外层下一次迭代
for (int $i = 0; $i < 3; $i++) {
    for (int $j = 0; $j < 3; $j++) {
        if ($j === 1) {
            continue 2;            // 直接跳到外层 i++ 循环
        }
    }
}
```

#### goto

`goto LABEL` 跳转到同一函数内的标签处，标签形如 `LABEL:`。常用于深层嵌套中一次性跳出，或错误处理跳转：

```php
class Main {
    public function main(): void {
        for (int $i = 0; $i < 10; $i++) {
            for (int $j = 0; $j < 10; $j++) {
                if ($i === 2 && $j === 3) {
                    goto found;    // 一次性跳出两层
                }
            }
        }
        echo "not found";
        goto end;

        found:
        echo "found at 2,3";

        end:
        echo "done";
    }
}
```

| 跳转语句 | 作用域 | 说明 |
|---------|--------|------|
| `break;` | 当前循环/switch | 跳出最内层结构 |
| `break N;` | N 层嵌套 | N 必须 ≥1，跳出第 N 层（loop label 栈实现） |
| `continue;` | 当前循环 | 跳过本次迭代，进入下一次 |
| `continue N;` | N 层嵌套 | 作用于第 N 层循环 |
| `goto LABEL;` | 同一函数内 | 跳转到 `LABEL:` 处，不可跳入循环体内部 |

> tphp 通过 **loop label 栈 + goto** 实现 `break N` / `continue N`，编译期已知跳转层级，零运行时开销。`goto` 仅限同一函数内跳转，不能跨函数；不能跳入 `for`/`while`/`foreach`/`switch` 结构体内部（会破坏控制流完整性）。`N` 必须为编译期整数常量。
