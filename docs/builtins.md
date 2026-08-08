## 内置函数 {#builtins}

**490+ 内置函数**，覆盖 PHP 标准库核心子集与常用扩展，全部编译进原生二进制，零外部依赖。函数清单、签名与差异说明的权威来源为项目内 [FUNCTIONS.md](https://github.com/KingBes/TinyPHP/blob/main/FUNCTIONS.md)。

> 与 PHP 的差异：多数函数签名与 PHP 一致，但部分参数被精简（如 `strpos` 无 `$offset`），返回值语义略有不同（如 `strpos` 未找到返回 `-1` 而非 `false`）。下文「差异」列为已确认的差异，使用前务必核对。

### 分类总览 {#func-overview}

| 分类 | 函数数 | 说明 |
|------|-------|------|
| 输出 / 类型 / 字符串 | 67 | — |
| HTML / Base64 / URL | 6 | — |
| 数组 | 41 | — |
| 数学 | 21 | — |
| 进制转换 | 8 | — |
| 断言 / 随机 | 5 | — |
| JSON | 3 | — |
| 哈希 | 5 | — |
| 时间 | 9 | — |
| ctype 字符检测 | 11 | — |
| mbstring (UTF-8) | 3 | — |
| iconv 字符集转换 | 8 | — |
| filter 过滤器 | 3 | — |
| password (bcrypt) | 2 | — |
| OOP / 异常 / Resource | 14 | — |
| Generator / yield | 7 | — |
| 多线程原语 | 15 | — |
| 异步与协程 | 20 | — |
| C 互操作 (PHPC) | 40 | — |
| 扩展（pcntl/posix/pcre/…） | 160+ | 见下「扩展函数」 |

---

### 字符串函数 {#string}

#### `strlen`

```php
strlen(string $s): int
```

- **参数**：`$s` — 输入字符串
- **返回**：字符串字节长度
- **差异**：与 PHP 8 语义一致

```php
echo strlen("hello");   // 5
echo strlen("中文");     // 6（UTF-8 三字节/字符）
```

#### `substr`

```php
substr(string $s, int $offset, int $length): string
```

- **参数**：`$s` — 输入字符串；`$offset` — 起始位置（可为负，从末尾倒数）；`$length` — 截取长度
- **返回**：子字符串
- **差异**：**`$length` 必传**，传 `0` 表示截取到末尾（PHP 中 `$length` 可选，省略表示到末尾）；越界返回空串

```php
echo substr("hello", 1, 0);     // "ello"（length=0 到末尾）
echo substr("hello", -2, 0);    // "lo"
echo substr("hello", 10, 0);   // ""（越界返回空串）
```

#### `strpos`

```php
strpos(string $haystack, string $needle): int
```

- **参数**：`$haystack` — 被搜索的字符串；`$needle` — 要查找的子串
- **返回**：首次出现的位置（从 0 开始），未找到返回 **`-1`**
- **差异**：未找到返回 **`-1`**（PHP 返回 `false`）；**无 `$offset` 参数**（PHP 支持第三参指定搜索起始位置）。注意：不能用 `=== false` 判断，应判断 `>= 0`

```php
echo strpos("hello", "l");       // 2
echo strpos("hello", "x");       // -1（PHP 中为 false）

if (strpos("hello", "l") >= 0) {
    echo "found";                // 输出 found
}
```

#### `str_replace`

```php
str_replace(string $search, string $replace, string $subject): string
```

- **参数**：`$search` — 查找串；`$replace` — 替换串；`$subject` — 目标串
- **返回**：替换后的字符串
- **差异**：**无 `$count` 参数**（PHP 支持第四参引用传回替换次数）

```php
echo str_replace("l", "L", "hello");              // "heLLo"
echo str_replace("world", "TPHP", "hello world"); // "hello TPHP"
```

#### `sprintf`

```php
sprintf(string $format, mixed ...$values): string
```

- **参数**：`$format` — 格式串（支持 `%d`/`%s`/`%f`/`%x` 等）；`...$values` — 替换值
- **返回**：格式化后的字符串
- **差异**：与 PHP 一致

```php
echo sprintf("name=%s, age=%d", "Tom", 18);   // "name=Tom, age=18"
echo sprintf("pi=%.2f", 3.14159);             // "pi=3.14"
echo sprintf("hex=%x", 255);                  // "hex=ff"
```

#### `explode`

```php
explode(string $separator, string $string): array
```

- **参数**：`$separator` — 分隔符；`$string` — 待分割字符串
- **返回**：分割后的数组
- **差异**：**无 `$limit` 参数**（PHP 支持第三参限制分割数量）

```php
$parts = explode(",", "a,b,c");
echo count($parts);    // 3
echo $parts[1];        // "b"
```

#### `implode`

```php
implode(string $separator, array $array): string
```

- **参数**：`$separator` — 分隔符；`$array` — 待拼接数组
- **返回**：拼接后的字符串
- **差异**：仅支持 `string`/`int`/`float` 元素（PHP 支持任意可转字符串的值）

```php
echo implode("-", ["a", "b", "c"]);   // "a-b-c"
echo implode(",", [1, 2, 3]);         // "1,2,3"
```

#### `trim` / `ltrim` / `rtrim`

```php
trim(string $s): string
ltrim(string $s): string
rtrim(string $s): string
```

- **参数**：`$s` — 输入字符串
- **返回**：去除空白后的字符串（`trim` 去首尾，`ltrim` 去首部，`rtrim` 去尾部）
- **差异**：**仅 ASCII 空白**（` \t\n\r\v\f`）；**无 `$characters` 参数**（PHP 支持自定义去除字符集）

```php
echo trim("  hello  ");      // "hello"
echo ltrim("  hello  ");     // "hello  "
echo rtrim("  hello  ");     // "  hello"
```

#### `strtolower` / `strtoupper`

```php
strtolower(string $s): string
strtoupper(string $s): string
```

- **参数**：`$s` — 输入字符串
- **返回**：转小写/大写后的字符串
- **差异**：**仅 ASCII 字母**（A-Z/a-z）转换，不支持 Unicode（PHP 默认按 locale，可能影响多字节字符）

```php
echo strtolower("HELLO");    // "hello"
echo strtoupper("hello");    // "HELLO"
echo strtolower("中文ABC");  // "中文abc"（仅 ASCII 部分转换）
```

#### `str_pad`

```php
str_pad(string $s, int $length, string $pad, int $type): string
```

- **参数**：`$s` — 输入串；`$length` — 目标长度；`$pad` — 填充串；`$type` — 填充类型（`STR_PAD_RIGHT`/`STR_PAD_LEFT`/`STR_PAD_BOTH`）
- **返回**：填充后的字符串
- **差异**：**4 参数全部必传**（PHP 中 `$pad` 和 `$type` 可选，默认空格和 `STR_PAD_RIGHT`）

```php
echo str_pad("5", 3, "0", STR_PAD_LEFT);   // "005"
echo str_pad("ab", 6, " ", STR_PAD_BOTH);  // "  ab  "
```

#### `str_split`

```php
str_split(string $s, int $length): array
```

- **参数**：`$s` — 输入串；`$length` — 每段长度
- **返回**：按长度切分后的数组
- **差异**：**`$length` 必传**（PHP 可选，默认 1）

```php
$chars = str_split("abc", 1);   // ["a", "b", "c"]
$pair = str_split("abcdef", 2); // ["ab", "cd", "ef"]
```

#### `str_repeat`

```php
str_repeat(string $s, int $n): string
```

- **参数**：`$s` — 输入串；`$n` — 重复次数
- **返回**：重复拼接后的字符串
- **差异**：与 PHP 一致

```php
echo str_repeat("ab", 3);    // "ababab"
echo str_repeat("-", 5);     // "-----"
```

#### `strrev`

```php
strrev(string $s): string
```

- **参数**：`$s` — 输入串
- **返回**：反转后的字符串（按字节反转）
- **差异**：按字节反转，多字节字符（如 UTF-8 中文）会乱序（与 PHP 一致）

```php
echo strrev("hello");    // "olleh"
```

#### `bin2hex` / `hex2bin`

```php
bin2hex(string $s): string
hex2bin(string $s): string
```

- **参数**：`$s` — 输入串（`bin2hex` 为二进制串，`hex2bin` 为十六进制串）
- **返回**：转换后的字符串
- **差异**：与 PHP 一致

```php
echo bin2hex("AB");      // "4142"
echo hex2bin("4142");    // "AB"
```

> 字符串插值（双引号 `$var` / `{$var->prop}`）和 heredoc/nowdoc 与 PHP 语法一致，详见语法参考。

---

### 数组函数 {#array}

支持泛型 `array<T>`（int/str/float/bool/var/ptr 六种元素类型，相比 `array<mixed>` 更省内存）。

#### `count`

```php
count(array $array): int
```

- **参数**：`$array` — 输入数组
- **返回**：数组元素个数
- **差异**：与 PHP 一致；传入 `array<T>` 时自动协变转换为通用数组

```php
echo count([1, 2, 3]);              // 3
$kv = ["a" => 1, "b" => 2];
echo count($kv);                    // 2
```

#### `in_array`

```php
in_array(mixed $needle, array $haystack): bool
```

- **参数**：`$needle` — 查找值；`$haystack` — 目标数组
- **返回**：是否找到
- **差异**：**无 `$strict` 参数**（类型固定，`==` 与 `===` 等价，无需严格模式）

```php
var_dump(in_array(2, [1, 2, 3]));       // true
var_dump(in_array("x", ["a", "b"]));    // false
```

#### `array_key_exists`

```php
array_key_exists(mixed $key, array $array): bool
```

- **参数**：`$key` — 键（int 或 string）；`$array` — 目标数组
- **返回**：键是否存在
- **差异**：与 PHP 一致

```php
$kv = ["name" => "Tom", "age" => 18];
var_dump(array_key_exists("name", $kv));    // true
var_dump(array_key_exists("x", $kv));       // false
```

#### `array_keys`

```php
array_keys(array $array): array<int>
```

- **参数**：`$array` — 输入数组
- **返回**：所有键组成的数组
- **差异**：返回类型推导为 **`array<int>`**；PHP 无类型区分

```php
$keys = array_keys(["a" => 1, "b" => 2]);
echo json_encode($keys);    // ["a","b"]
```

#### `array_merge`

```php
array_merge(array ...$arrays): array
```

- **参数**：`...$arrays` — 待合并数组
- **返回**：合并后的数组（int 键重新索引，string 键后写覆盖）
- **差异**：返回数组元素类型跟随源数组

```php
$m = array_merge([1, 2], [3, 4]);
echo json_encode($m);    // [1,2,3,4]
$n = array_merge(["a" => 1], ["a" => 2]);
echo $n["a"];            // 2（后写覆盖）
```

#### `array_slice`

```php
array_slice(array $array, int $offset, int $length): array
```

- **参数**：`$array`；`$offset`（起始，可为负）；`$length`（长度）
- **返回**：切片数组
- **差异**：返回元素类型跟随源数组

```php
$s = array_slice([1, 2, 3, 4, 5], 1, 2);
echo json_encode($s);    // [2,3]
```

#### `array_unique` / `array_reverse` / `array_diff` / `array_intersect`

```php
array_unique(array $array): array
array_reverse(array $array): array
array_diff(array $a, array $b): array
array_intersect(array $a, array $b): array
```

- **返回**：处理后的数组
- **差异**：返回元素类型跟随源数组

```php
echo json_encode(array_unique([1, 2, 2, 3]));              // [1,2,3]
echo json_encode(array_reverse([1, 2, 3]));                // [3,2,1]
echo json_encode(array_diff([1, 2, 3], [2]));              // [1,3]
echo json_encode(array_intersect([1, 2, 3], [2, 3, 4]));   // [2,3]
```

#### `sort` / `rsort` / `shuffle`

```php
sort(array &$array): void
rsort(array &$array): void
shuffle(array &$array): void
```

- **参数**：`$array`（引用传入，原地修改）
- **返回**：无（原地排序/打乱）
- **差异**：针对 `array<T>` 优化；PHP 的 `sort` 有 `$flags` 参数，TinyPHP 无

```php
array<int> $nums = [3, 1, 2];
sort($nums);              // → [1, 2, 3]
rsort($nums);             // → [3, 2, 1]
shuffle($nums);           // 随机打乱
```

#### `array_push` / `array_pop` / `array_shift` / `array_unshift`

```php
array_push(array &$array, mixed $value): int
array_pop(array &$array): mixed
array_shift(array &$array): mixed
array_unshift(array &$array, mixed $value): int
```

- **差异**：**对 `array<T>` 拒绝**（`mixed` 参数与特化数组不兼容）；**用 `$arr[] = $v` 替代 `array_push`**（语法糖，支持特化数组）

```php
array<int> $nums = [1, 2, 3];
$nums[] = 4;              // ✅ 推荐写法
// array_push($nums, 4);  // ❌ 对 array<int> 编译错误

$arr = [1, 2, 3];         // array<mixed>，可用
array_push($arr, 4);
$v = array_pop($arr);     // 4
$head = array_shift($arr);// 1
array_unshift($arr, 0);
```

#### `asort` / `arsort` / `ksort` / `uasort` / `usort`

```php
asort(array &$array): void
arsort(array &$array): void
ksort(array &$array): void
uasort(array &$array, callable $cmp): void
usort(array &$array, callable $cmp): void
```

- **差异**：对 `array<T>` 拒绝（排序需保持值-键关联，不适用于纯索引的特化数组）；对 `array<mixed>` 可用

```php
$kv = ["b" => 2, "a" => 1, "c" => 3];
asort($kv);               // 按 value 升序，键保留
echo json_encode($kv);     // {"a":1,"b":2,"c":3}

$mixed = [3, 1, 2];
usort($mixed, fn(int $a, int $b): int => $b - $a);  // 自定义降序
```

#### `array_fill` / `array_column` / `array_count_values`

```php
array_fill(int $start, int $count, mixed $value): array
array_column(array $array, mixed $column): array
array_count_values(array $array): array
```

- **差异**：返回元素类型有默认值（非完全跟随源数组）

```php
$a = array_fill(0, 3, "x");
echo json_encode($a);     // ["x","x","x"]

$rows = [["id" => 1], ["id" => 2]];
$ids = array_column($rows, "id");
echo json_encode($ids);   // [1,2]
```

#### `array_map` / `array_filter` / `array_reduce`

> **暂未提供**：源项目 README/GRAMMAR 未明确列出这三个函数。如需类似功能，可用 `foreach` 循环手动实现，或通过闭包封装自定义辅助函数。
>
> ```php
> // 手动 map 示例
> $src = [1, 2, 3];
> $dst = [];
> foreach ($src as $v) { $dst[] = $v * 2; }   // [2, 4, 6]
> ```

---

### 数学函数 {#math}

#### `abs`

```php
abs(int $n): int
abs(float $n): float
```

- **参数**：`$n` — 数值
- **返回**：绝对值（int 入参返回 int，float 入参返回 float）
- **差异**：按参数类型区分 int/float（PHP 自动转换）

```php
echo abs(-5);       // 5（int）
echo abs(-3.14);    // 3.14（float）
```

#### `floor` / `ceil`

```php
floor(float $n): float
ceil(float $n): float
```

- **参数**：`$n` — 浮点数
- **返回**：向下/向上取整（返回 float 类型，与 PHP 一致）

```php
echo floor(3.7);    // 3
echo ceil(3.2);     // 4
```

#### `sqrt`

```php
sqrt(float $n): float
```

- **参数**：`$n` — 数值
- **返回**：平方根
- **差异**：负数返回 `NAN`（与 PHP 一致）

```php
echo sqrt(16);      // 4
echo sqrt(-1);      // NAN
```

#### `pow`

```php
pow(mixed $base, mixed $exp): int|float
```

- **参数**：`$base` — 底数；`$exp` — 指数
- **返回**：幂运算结果（int^int 返回 int，含 float 返回 float）
- **差异**：int^int 返回 int，含 float 返回 float（按类型区分）

```php
echo pow(2, 10);    // 1024
echo pow(2.0, 0.5); // 1.4142135623731
echo 2 ** 10;       // 1024（** 运算符等价）
```

#### `intdiv`

```php
intdiv(int $a, int $b): int
```

- **参数**：`$a` — 被除数；`$b` — 除数
- **返回**：整数商（向零取整）
- **差异**：零除时抛异常（可被 try-catch 捕获），**非 PHP 的 `DivisionByZeroError` 对象**

```php
echo intdiv(7, 2);    // 3
echo intdiv(-7, 2);   // -3（向零取整）
try {
    intdiv(1, 0);
} catch (\Throwable $e) {
    echo "Division by zero";   // 捕获异常
}
```

#### `fmod`

```php
fmod(float $x, float $y): float
```

- **参数**：`$x` — 被除数；`$y` — 除数
- **返回**：浮点取模
- **差异**：与 PHP 一致

```php
echo fmod(5.7, 1.3);    // 0.5
```

#### `pi`

```php
pi(): float
```

- **返回**：圆周率 π（3.1415926535898）
- **差异**：与 PHP 一致

```php
echo pi();               // 3.1415926535898
echo pi() * 2;           // 6.2831853071796
```

#### 三角函数

```php
sin(float $x): float   cos(float $x): float   tan(float $x): float
asin(float $x): float   acos(float $x): float  atan(float $x): float
sinh(float $x): float   cosh(float $x): float  tanh(float $x): float
```

- **参数**：`$x` — 弧度
- **返回**：三角函数值
- **差异**：与 PHP 一致

```php
echo sin(pi() / 2);      // 1
echo cos(0);             // 1
echo tan(pi() / 4);      // 1（约等于）
```

#### `deg2rad` / `rad2deg`

```php
deg2rad(float $deg): float
rad2deg(float $rad): float
```

- **差异**：与 PHP 一致

```php
echo deg2rad(180);       // 3.1415926535898
echo rad2deg(pi());      // 180
```

#### `exp` / `log` / `log10`

```php
exp(float $x): float
log(float $x): float
log10(float $x): float
```

- **差异**：`log` **无 `$base` 参数**（PHP 支持第二参指定底数，TinyPHP 仅自然对数）

```php
echo exp(1);             // 2.718281828459045
echo log(exp(1));        // 1（自然对数）
echo log10(1000);        // 3
```

#### `is_finite` / `is_infinite` / `is_nan`

```php
is_finite(float $n): bool
is_infinite(float $n): bool
is_nan(float $n): bool
```

- **差异**：与 PHP 一致

```php
var_dump(is_finite(3.14));      // true
var_dump(is_infinite(log(0)));  // true
var_dump(is_nan(sqrt(-1)));     // true
```

#### 进制转换

```php
bindec(string $s): int    hexdec(string $s): int    octdec(string $s): int
decbin(int $n): string    decoct(int $n): string    dechex(int $n): string
base_convert(string $s, int $from, int $to): string
```

- **差异**：`base_convert` 精度受 64 字节缓冲限制（约 20 位十进制）

```php
echo bindec("1010");             // 10
echo dechex(255);                // "ff"
echo base_convert("ff", 16, 2);  // "11111111"
```

#### `min` / `max` / `round`

> **暂未提供**：源项目 README/GRAMMAR 未明确列出 `min`/`max`/`round`。可用比较运算符或三元表达式手动实现：
>
> ```php
> $min = $a < $b ? $a : $b;
> $max = $a > $b ? $a : $b;
> $rounded = (int)floor($x + 0.5);   // 简单四舍五入
> ```

---

### 类型函数 {#type}

#### `isset`

```php
isset(mixed $var): bool
isset(mixed $var, mixed ...$rest): bool
```

- **参数**：`$var` — 待检测变量（可多个）
- **返回**：变量是否已设置且非 null（多个参数时全设置才返回 true）
- **差异**：值类型恒为非 null，返回 `true`；指针类型运行时 NULL 检测

```php
$arr = ["k" => 1];
var_dump(isset($arr["k"]));           // true
var_dump(isset($arr["x"]));           // false
var_dump(isset($arr["k"], $arr["x"])); // false（全设置才 true）
```

#### `empty`

```php
empty(mixed $var): bool
```

- **参数**：`$var` — 待检测变量
- **返回**：变量是否为「空」（`0`/`""`/`"0"`/`null`/`false`/`[]`/未设置）
- **差异**：与 PHP falsy 语义一致

```php
var_dump(empty(""));       // true
var_dump(empty(0));        // true
var_dump(empty([]));       // true
var_dump(empty("hello"));  // false
```

#### `instanceof`

```php
$var instanceof ClassName
```

- **说明**：`instanceof` 是**运算符**，非函数。判断变量是否为指定类/接口的实例
- **差异**：遍历类链判断（与 PHP 一致）；**对接口判断不生效**

```php
class Animal {}
class Dog extends Animal {}

$d = new Dog();
var_dump($d instanceof Dog);      // true
var_dump($d instanceof Animal);   // true
```

#### `gettype` / `is_int` / `is_string` / `is_array` / `is_bool` / `is_float` / `is_object`

> **暂未提供**：源项目 README/GRAMMAR 未明确列出 `gettype`/`is_int`/`is_string`/`is_array`/`is_bool`/`is_float`/`is_object` 等类型判断函数。类型在编译期已知，类型判断多可由类型注解或 `instanceof` 替代；如需运行时类型分支，可使用 `mixed` 类型配合 `instanceof` 判断。

---

### 对象函数 {#object}

#### `get_class`

```php
get_class(object $obj): string
```

- **参数**：`$obj` — 对象
- **返回**：对象的类名
- **差异**：匿名类返回 `_AnonClass${N}`（非 PHP 原生 `class@anonymous`）

```php
class Foo {}
$f = new Foo();
echo get_class($f);    // "Foo"

$anon = new class {};
echo get_class($anon); // "_AnonClass0"（限制）
```

#### `method_exists` / `property_exists`

> **暂未提供**：源项目 README/GRAMMAR 未明确列出 `method_exists`/`property_exists`。类型在编译期已固定，方法/属性是否存在可在编译期确定，无需运行时检测。

#### `get_object_vars`

> `stdClass` 支持通过 `get_object_vars($obj)` 转数组后用 `$arr[$key]` 访问属性（替代 PHP 动态属性名 `$obj->$var`，类型约束下推荐的访问方式）。

---

### 输出函数 {#output}

#### `echo`

```php
echo expr (, expr)*;
```

- **参数**：一个或多个表达式（逗号分隔）
- **返回**：无（语句，非函数）
- **差异**：`echo` 是**语句**（PHP 中也是语言结构），支持多参数逗号分隔

```php
echo "hello", " ", "world", "\n";    // hello world
echo 42;                             // 42
echo sprintf("pi=%.2f\n", pi());     // pi=3.14
```

#### `var_dump`

```php
var_dump(mixed $var): void
var_dump(mixed $var, mixed ...$rest): void
```

- **参数**：`$var` — 待输出变量（可多个）
- **返回**：无
- **差异**：输出 PHP 风格的类型化调试信息（`int(42)`/`string(5) "hello"`/`bool(true)`/`array(N) {...}`），与 PHP 输出格式一致；常用于 `#debug` 测试断言

```php
var_dump(42);            // int(42)
var_dump("hello");       // string(5) "hello"
var_dump(true);          // bool(true)
var_dump([1, 2, 3]);     // array(3) { [0]=> int(1) [1]=> int(2) [2]=> int(3) }
```

#### `print` / `print_r`

> **暂未提供**：源项目 README/GRAMMAR 未明确列出 `print`（作为独立语句/函数）和 `print_r`。输出文本用 `echo`，调试输出用 `var_dump`。

---

### 进程函数 {#process}

#### `exit`

> **暂未提供详细说明**：`exit` 在源项目中作为 `never` 返回类型的语义出口被提及（与 `throw` 并列），但作为可调用函数的签名/参数未在 README/GRAMMAR 中明确列出。可用 `throw new Exception()` 抛异常退出，或在 `main()` 末尾正常返回。

#### `sleep` / `usleep`

> **暂未提供**：源项目 README/GRAMMAR 未明确列出 `sleep`/`usleep` 函数。多线程场景可用 `Thread::sleep(float $seconds)` 静态方法（README 中已确认支持）。
>
> ```php
> Thread::sleep(1.5);   // 休眠 1.5 秒（已确认支持）
> ```

---

### 编码函数 {#encoding}

#### `json_encode`

```php
json_encode(mixed $value): string
```

- **参数**：`$value` — 待编码值（数组/标量）
- **返回**：JSON 字符串
- **差异**：**无 `$flags`/`$depth` 参数**；`NaN`/`Inf` 转为 `null`；编码结果 `> 8MB` 返回 `"null"`

```php
echo json_encode([1, 2, 3]);                    // [1,2,3]
echo json_encode(["a" => 1, "b" => [2, 3]]);    // {"a":1,"b":[2,3]}
echo json_encode("hello");                      // "hello"
echo json_encode(NAN);                          // null
```

#### `json_decode`

```php
json_decode(string $json): mixed
```

- **参数**：`$json` — JSON 字符串
- **返回**：解码后的值（对象解析为**关联数组**）
- **差异**：**仅 1 个参数**（PHP 支持 `$assoc`/`$depth`/`$flags`）；**对象解析为关联数组**（PHP 默认解析为 stdClass）；失败返回 `NULL`

```php
$obj = json_decode('{"x":42}');
var_dump($obj["x"]);               // 42（关联数组）
$arr = json_decode('[1, 2, 3]');
echo $arr[0];                      // 1
var_dump(json_decode("invalid"));  // NULL
```

#### `base64_encode` / `base64_decode`

```php
base64_encode(string $s): string
base64_decode(string $s): string
```

- **参数**：`$s` — 输入串
- **返回**：Base64 编码/解码后的字符串
- **差异**：与 PHP 一致（与 HTML/URL 编码同组）

```php
$enc = base64_encode("Hello, World!");
echo $enc;                      // SGVsbG8sIFdvcmxkIQ==
echo base64_decode($enc);       // Hello, World!
```

> **字符集转换**：`iconv` 扩展提供 8 个字符集转换函数（如 `iconv("UTF-8", "GBK", $s)`），见 `#import iconv`；`mbstring` 提供 3 个 UTF-8 函数。

---

### 序列化函数 {#serialize}

#### `serialize` / `unserialize`

> **暂未提供**：源项目 README/GRAMMAR 明确标注 `__sleep`/`__wakeup`/`__serialize`/`__unserialize` 等序列化魔术方法不支持。`serialize`/`unserialize` 函数未在内置函数清单中列出。如需对象持久化，可手动实现 `to_array()`/`from_array()` 方法，再配合 `json_encode`/`json_decode` 完成。
>
> ```php
> class Point {
>     public function __construct(public float $x, public float $y) {}
>     public function to_array(): array { return ["x" => $this->x, "y" => $this->y]; }
>     public static function from_array(array $a): Point {
>         return new Point($a["x"], $a["y"]);
>     }
> }
>
> $p = new Point(1.0, 2.0);
> $json = json_encode($p->to_array());   // {"x":1,"y":2}
> $p2 = Point::from_array(json_decode($json));
> ```

---

### 哈希 / 密码 / 时间 {#func-data}

#### 哈希函数

```php
md5(string $s): string
sha1(string $s): string
sha256(string $s): string
sha512(string $s): string
hash_hmac(string $algo, string $data, string $key): string
crc32(string $s): string
```

- **差异**：**无 `$binary` 参数**（恒返回 hex 字符串，PHP 默认返回 hex）；`hash_hmac` 支持 `sha256`/`sha512`

```php
echo md5("abc");                          // 900150983cd24fb0d6963f7d28e17f72
echo sha256("abc");                       // ba7816bf...（64 字符小写 hex）
echo hash_hmac("sha256", "data", "key");   // HMAC-SHA256 hex
```

#### 密码函数（bcrypt）

```php
password_hash(string $password, int $algo, array $options): string
password_verify(string $password, string $hash): bool
```

- **差异**：`password_hash` **仅支持 `PASSWORD_BCRYPT`**；cost 硬编码 10（PHP 可配）；空密码抛错；`password_verify` 常量时间比较防时序攻击，支持 `$2a/$2b/$2x/$2y` 前缀，与 PHP 完全兼容

```php
$hash = password_hash("secret", PASSWORD_BCRYPT, []);
echo strlen($hash);                         // 60（$2b$10$...）
var_dump(password_verify("secret", $hash)); // true
var_dump(password_verify("wrong", $hash));  // false
```

#### 时间函数

```php
time(): int
date(string $format, int $timestamp): string
mktime(int $h, int $m, int $s, int $mo, int $d, int $y): int
strtotime(string $s): int
microtime(): float
```

- **差异**：
  - `date` 仅支持 `Y/y/m/n/d/j/H/G/i/s` 10 个格式符（PHP 支持全部）；`timestamp < 0` 回退 `time()`；**无时区支持**
  - `mktime` 6 参数全必填；不归一化越界值
  - `strtotime` 仅支持 `Y-m-d`/`Y/m/d` + `H:i:s` 绝对格式；**不支持相对/自然语言**
  - `microtime` 永远返回浮点秒（无参数，PHP 无参返回字符串）

```php
echo time();                              // Unix 时间戳
echo date("Y-m-d H:i:s", time());        // 2026-08-08 12:34:56（10 格式符）
echo microtime();                         // 1715000000.123456（浮点秒）
```

---

### 随机 / 断言 {#func-random}

#### 随机函数

```php
rand(int $min, int $max): int
mt_rand(int $min, int $max): int
random_int(int $min, int $max): int
random_bytes(int $length): string
```

- **差异**：
  - `rand` **强制 2 参**（不支持无参形式）；伪随机
  - `mt_rand` 等同 `rand`，非真正 Mersenne Twister
  - `random_int` 真 CSPRNG，防模偏差；`min > max` 抛错
  - `random_bytes` 真 CSPRNG；`> 1048576` 抛错

```php
echo rand(1, 100);            // 1-100 伪随机
echo random_int(1, 6);        // 1-6 CSPRNG（骰子）
$token = random_bytes(16);   // 16 字节随机串
```

#### 断言函数

```php
assert_true(bool $cond): void
assert_false(bool $cond): void
assert_eq_int(int $expected, int $actual): void
assert_eq_float(float $expected, float $actual): void
assert_eq_str(string $expected, string $actual): void
```

- **差异**：TinyPHP 自有断言（非 PHP `assert()`），失败时输出错误并退出

```php
assert_eq_int(2, 1 + 1);
assert_true(strlen("abc") === 3);
```

---

### 正则 PCRE {#func-pcre}

**按需 `#import pcre`**。内置 ReDoS 防护：回溯超限时安全失败，恶意模式 `(a+)+$` 不会阻塞进程。

```php
#import pcre

class Main {
    public function main(): void {
        $m = preg_match("/\d+/", "abc123def");
        echo $m[0];                    // "123"（返回数组而非 int + byRef！）
        $all = preg_match_all("/\w+/", "a b c");
        echo count($all);              // 3
        echo preg_replace("/\s+/", "-", "a  b");  // "a-b"
    }
}
```

| 函数 | 差异 |
|------|------|
| `preg_match($pattern, $subject): array` | **返回匹配数组**（`result[0]`=完整匹配），无匹配返回空数组（非 `false`） |
| `preg_match_all($pattern, $subject): array` | 返回二维数组；固定 `PREG_PATTERN_ORDER` |
| `preg_replace($pattern, $replacement, $subject, $limit): string` | 仅单字符串；支持 `$1`-`$9` 反向引用；**不支持回调** |
| `preg_split/preg_grep/preg_quote/preg_last_error(_msg)` | `preg_split` 仅 `PREG_SPLIT_NO_EMPTY`；`preg_grep` 字符串键降级 |

不支持：lookahead / lookbehind / 原子组 `(?>)` / 占有量词 `*+` / Unicode 属性类 `\p{}`；`\a`=`[a-z]`（PHP 为 BEL）。

---

### 扩展函数 {#func-extensions}

| 扩展 | 函数数 | 说明 |
|------|-------|------|
| `pcntl` | 7 | 进程控制（fork/wait/signal…） |
| `posix` | 14 | POSIX 系统调用 |
| `pcre` | 8 | 正则（见上） |
| `zlib` | 29 | gzip/zlib/deflate 压缩 + 流式 + 增量上下文 |
| `zip` | 18 | ZIP 归档读写 |
| `exif` | 8 | EXIF 图像元数据 |
| `calendar` | 16 | 日历转换 |
| `fileinfo` | 6 | MIME 类型检测 |
| `stream` | 21 | socket stream |
| `openssl` | 21 | TLS/加密 |
| `pdo` | 33 | PDO 统一 API + SQLite 驱动 |
| `pdo_mysql` | 0 | **无独立函数**（复用 PDO API） |
| `sqlite3` | 11 | 函数式 SQLite |
| `pgsql` | 78 | PostgreSQL |
| `pdo_pgsql` | 3 | PostgreSQL PDO 驱动 |
| `curl` | 35 | HTTP 客户端（690 常量） |
| `ui` | 9 类+9 枚举 | 图形界面，可编译 Android APK |

### ⚠️ 部分支持项 {#func-partial}

- **curl Multi Handle**：11 个函数中 **6 个是 stub 抛 `Exception`**（`curl_multi_add_handle` / `curl_multi_exec` / `curl_multi_select` 等），无异步 I/O，用顺序 `curl_exec` 替代
- **curl Share Handle**：6 个中 2 个 stub（`curl_share_setopt` 等）
- **pdo_mysql**：0 个函数，全部走 PDO 统一 API
- **filter_var**：支持验证/净化过滤器与部分标志位

[查看完整函数列表与签名 → FUNCTIONS.md](https://github.com/KingBes/TinyPHP/blob/main/FUNCTIONS.md)
