## 异常与错误 {#exceptions}

程序运行时难免遇到意外：除数为零、文件不存在、参数不合法……tphp 用**异常**机制把这些意外"抛"出来，再由调用方决定如何"接"。异常被 `catch` 时会中断当前执行流并跳转到 catch 块，未被任何 catch 捕获时程序终止并输出错误信息。

tphp 内置 `Exception` 类作为所有异常的基类，提供 `getMessage()`、`getCode()`、`getPrevious()` 三个方法。你可以继承它来自定义异常类型。

### try/catch/finally {#try-catch}

`try` 块包住可能出错的代码，`catch` 块接住抛出的异常，`finally` 块无论是否发生异常都会执行（常用于清理资源）。三者组合起来就像"先试试看，出问题就接住，最后无论如何都收尾"。

```php
function divide(int $a, int $b): int|Exception {
    if ($b === 0) {
        throw new Exception("div by zero");
    }
    return intdiv($a, $b);
}

class Main {
    public function main(): void {
        try {
            $r = divide(10, 0);
            echo $r;
        } catch (Exception $e) {
            echo "出错: " . $e->getMessage();   // 出错: div by zero
        } finally {
            echo "收尾\n";                       // 无论是否异常都执行
        }
    }
}
```

`finally` 是**可选的**——只有 `try`/`catch`、不要 `finally` 完全合法：

```php
try {
    $r = divide(10, 2);
} catch (Exception $e) {
    echo $e->getMessage();
}
```

> 注意：`defer` 语句的清理代码在异常路径上**不会执行**。如果需要保证异常路径上的资源清理，请把清理逻辑放在 `finally` 块里。

### catch 类型限制 {#catch-types}

tphp 的 `catch` 只能捕获 `Exception` 及其子类，**不支持 `Throwable`**。需要兜底捕获时直接用 `catch (Exception $e)` 即可。

| 写法 | 状态 | 说明 |
|------|------|------|
| `catch (Exception $e)` | ✅ | 捕获所有异常（推荐兜底写法） |
| `catch (MyException $e)` | ✅ | 捕获自定义 Exception 子类 |
| `catch (\Throwable $e)` | ❌ | 不支持，改用 `catch (Exception $e)` |
| `catch ($e)` | ✅ | 无类型兜底，捕获字符串消息（非对象异常） |

可以写**多个 catch**，按声明顺序从具体到宽泛匹配——一旦某个 catch 命中，后面的就不再执行：

```php
class InvalidInput extends Exception {}
class NetworkError extends Exception {}

class Main {
    public function main(): void {
        try {
            // ...可能抛出不同异常的逻辑...
            throw new InvalidInput("bad param");
        } catch (InvalidInput $e) {
            echo "参数错误: " . $e->getMessage();
        } catch (NetworkError $e) {
            echo "网络错误: " . $e->getMessage();
        } catch (Exception $e) {
            echo "其他错误: " . $e->getMessage();   // 兜底
        }
    }
}
```

无类型的 `catch ($e)` 用来兜底捕获非对象异常（如字符串消息），适合和 `error()` 搭配处理简单错误场景。

### throw 抛出 {#throw}

`throw` 语句把一个 `Exception` 对象抛出，立刻打断当前执行流，沿着调用栈往上找最近的 `catch`：

```php
function check_age(int $age): void|Exception {
    if ($age < 0) {
        throw new Exception("age cannot be negative");
    }
    if ($age > 200) {
        throw new Exception("age too large");
    }
}
```

`throw` 也能作为**表达式**使用（PHP 8.0+ 语法），可以出现在三元、空合并等表达式位置——这在"给变量一个默认值或直接报错"的场景很方便：

```php
class Main {
    public function main(): void {
        $config = load_config() ?? throw new Exception("config missing");

        // 三元里抛出
        $name = strlen($input) > 0 ? $input : throw new Exception("empty name");
    }
}
```

> 不管是语句还是表达式形式，只要函数体里出现了 `throw`，返回类型就必须声明 `|Exception`（见[下一节](#type-exception)）。

### error() 简写 {#error}

`error($msg)` 是 `throw new Exception($msg)` 的简写。两者完全等价——抛出可被 `try-catch` 捕获的异常；如果没有被任何 `catch` 接住，则程序终止并输出 Fatal error 信息。

对比两种写法：

```php
// 完整写法
function find_user(int $id): string|Exception {
    $user = lookup($id);
    if ($user === "") {
        throw new Exception("user not found: " . $id);
    }
    return $user;
}

// 用 error() 简写，更简洁
function find_user2(int $id): string|Exception {
    $user = lookup($id);
    if ($user === "") {
        error("user not found: " . $id);
    }
    return $user;
}
```

两种写法生成的代码、捕获行为完全一致。`error()` 适合在快速校验、断言式失败的场景下省去 `new Exception(...)` 的样板代码。和 `throw` 一样，函数体含 `error()` 调用时返回类型也必须声明 `|Exception`。

### Type|Exception 返回类型 {#type-exception}

这是 tphp 的**扩展语法**。当一个函数/方法体里直接出现了 `throw` 语句/表达式或 `error()` 调用时，**必须**在返回类型中用 `|Exception`（或任意 Exception 子类，如 `|RuntimeException`）声明它可能抛异常：

```php
function parse_int(string $s): int|Exception {
    if (!ctype_digit($s)) {
        error("not a digit string: " . $s);
    }
    return (int)$s;
}

// 也可以用具体的 Exception 子类
function load_config(): array|RuntimeException {
    $cfg = read_file();
    if ($cfg === "") {
        throw new RuntimeException("config empty");
    }
    return $cfg;
}
```

这里的关键点是——`|Exception` **只是文档提示，不影响运行时性能**：

- `|` 后的 `Exception` 部分仅用于声明意图，实际返回类型仍是 `|` 前的类型（`int|Exception` 视作 `int`，`array|RuntimeException` 视作 `array`）。
- 编译器会检查 `|` 后的类型确实是 `Exception` 的子类，否则编译报错。
- 这条规则**不追溯间接调用**——即调用其他可能 throw 的函数，不需要在自己这里声明 `|Exception`，只看本函数体里有没有直接 `throw`/`error()`。

```php
// 直接 throw → 必须声明 |Exception
function unsafe(int $x): int|Exception {
    if ($x < 0) throw new Exception("negative");
    return $x;
}

// 只调用 unsafe()，自己不 throw → 不需要声明 |Exception
function caller(int $x): int {
    return unsafe($x);   // 合法，异常会向上传播
}
```

> 注意区分：普通的联合类型（如 `int|string`）会按 `mixed` 处理，有运行时开销，且仅作返回类型支持。而 `Type|Exception` 是专门的"可能抛异常"标记，与 `Type` 单类型完全等价。

### never 返回类型 {#never}

`never` 表示这个函数**永远不会正常返回**——要么无限循环，要么总是抛异常/调用 `exit`。语义上告诉调用方"别指望拿到返回值"。

```php
function fail(string $msg): never {
    throw new Exception($msg);
}

function run_forever(): never {
    while (true) {
        process_queue();
    }
}
```

`never` 常用于两类场景：

- **总抛异常的失败函数**：如 `fail()`、`abort()`，调用它们之后代码就不会继续往下走了，编译器据此可以省略后续分支。
- **无限循环**：如事件循环、服务主循环，函数永远不会走到结尾。

```php
class Main {
    public function main(): void {
        $mode = "server";
        $port = $mode === "server" ? 8080 : fail("unknown mode");
        // 这里编译器知道 fail() 不会返回，$port 在 else 分支不会被赋值也不会报错
    }
}
```

> `never` 和 `void` 的区别：`void` 表示函数正常结束但不返回值；`never` 表示函数根本不会正常结束。一个会 `return;` 的函数不能用 `never`，一个总抛异常的函数用 `void` 也能编译，但写 `never` 能更准确地表达意图、并帮助编译器做控制流分析。
