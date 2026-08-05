## 内置函数 {#builtins}

**490+ 内置函数**，覆盖 PHP 标准库核心子集与常用扩展，全部以 AOT 编译进原生二进制，零外部依赖。函数清单、签名与差异说明的权威来源为项目内 [FUNCTIONS.md](https://github.com/KingBes/TinyPHP/blob/main/FUNCTIONS.md)。

> 与 PHP 的差异：多数函数签名与 PHP 一致，但部分参数被精简（如 `strpos` 无 `$offset`），返回值语义略有不同（如 `strpos` 未找到返回 `-1` 而非 `false`）。下表「差异」列为已确认的差异，使用前务必核对。

### 分类总览 {#func-overview}

| 分类 | 函数数 | 说明 |
|------|-------|------|
| 输出 / 类型 / 字符串 | 67 | `std/core.h` |
| HTML / Base64 / URL | 6 | `std/html.h` |
| 数组 | 41 | `array.h` + `std/array_extra.h` |
| 数学 | 21 | `std/math.h` + `tphp_math.h` |
| 进制转换 | 8 | `conv.h` |
| 断言 / 随机 | 5 | `std/ctrl.h` + `rand.h` |
| JSON | 3 | `os/json.h` |
| 哈希 | 5 | `hash.h` |
| 时间 | 9 | `os/times.h` |
| ctype 字符检测 | 11 | `std/ctrl.h` |
| mbstring (UTF-8) | 3 | `std/utf8.h` |
| iconv 字符集转换 | 8 | `iconv.h` |
| filter 过滤器 | 3 | `filter.h` |
| password (bcrypt) | 2 | `os/password.h` |
| OOP / 异常 / Resource | 14 | `object/` |
| Generator / yield | 7 | `object/generator.h` + `minicoro.h` |
| 多线程原语 | 15 | `object/thread.h` |
| 异步与协程 | 20 | `object/channel.h` |
| C 互操作 (PHPC) | 40 | `phpc.h` |
| 扩展（pcntl/posix/pcre/…） | 160+ | 见下「扩展函数」 |

### 字符串 {#func-strings}

字符串是 16 字节 SSO 值类型 `{ char* data; int length; bool is_local; }`：≤23 字节内联零分配，3+ 片段 `.` 链编译期展平为 ROPE 单次分配。

| 函数 | 差异 |
|------|------|
| `strlen(string $s): int` | 返回 `s.length`，O(1) |
| `substr(string $s, int $offset, int $length): string` | **`$length` 必传**（`0` 表示到末尾）；越界返回空串 |
| `strpos(string $h, string $n): int` | 未找到返回 **`-1`**（非 `false`）；无 `$offset` |
| `str_replace(string $s, string $r, string $subj): string` | 无 `$count` 参数；数组参数变体由编译器展开 |
| `implode(string $sep, array $a): string` / `explode(string $sep, string $s): array` | implode 仅 string/int/float 元素；explode 无 `$limit` |
| `sprintf(string $fmt, mixed ...$v): string` | 编译期内联 `snprintf` 测长→分配；string→`.data`，float→`(double)`，其余→`(int)` |
| `trim/ltrim/rtrim/strtolower/strtoupper` | 仅 ASCII（PHP 支持 Unicode）；trim 无 `$characters` 参数 |
| `str_pad/str_split/str_repeat/strrev/bin2hex/hex2bin` | `str_pad` 4 参数必传；`str_split` 的 `$length` 必传 |

```php
class Main {
    public function main(): void {
        $s = "  hello  ";
        echo strlen($s);               // 9
        echo strpos("abc", "x");       // -1（PHP 中为 false）
        echo substr("hello", 1, 0);    // "ello"（length 0 = 到末尾）
        echo str_replace("l", "L", "hello");  // "heLLo"
    }
}
```

### 数组 {#func-arrays}

数组为 `t_array*`（128 槽 LIFO 复用池 + 1.5× 增长 + str/int 键双哈希索引，≥8 键触发 O(1) 查找）。支持泛型 `array<T>`（int/str/float/bool/var/ptr 六种单态化存储，`array<int>` 元素 8 字节 vs `array<mixed>` 24 字节，**省 67% 内存**）。

| 函数 | 差异 |
|------|------|
| `count(array $a): int` / `in_array(mixed $v, array $a): bool` / `array_key_exists(...)` | 自动协变转换为通用数组 |
| `array_merge/array_slice/array_unique/array_reverse/array_diff/array_intersect` | 返回数组元素类型跟随源数组 |
| `sort/rsort/shuffle` | 特化实现，直接操作特化数组内存 |
| `array_push/array_pop/array_shift/array_unshift` | **对 `array<T>` 拒绝**（编译期异常），用 `$arr[] = $v` 替代 |
| `asort/arsort/ksort/uasort/usort` | 对 `array<T>` 抛编译期异常（不适用于有序列表） |
| `array_fill/array_column/array_count_values/str_split` | 返回元素类型有硬编码默认值 |
| `array_keys` | 返回 `array<int>` |

```php
class Main {
    public function main(): void {
        array<int> $nums = [3, 1, 2];
        sort($nums);                    // 特化排序
        $nums[] = 4;                    // 追加（不要用 array_push）
        // $nums[] = "x";               // 编译错误：int 数组 push 字符串

        $kv = ["a" => 1, "b" => 2];
        echo count($kv);                // 2
        echo json_encode(array_keys($kv));  // ["a","b"]
    }
}
```

### 数学 / 进制 {#func-math}

| 函数 | 差异 |
|------|------|
| `abs/ceil/floor/sqrt/pow/pi/fmod/intdiv/deg2rad/rad2deg` | `abs` 按参数类型分派 int/float；`sqrt` 负数返回 `NAN`；`intdiv` 零除 `tp_throw`（字符串异常，非 `DivisionByZeroError` 对象） |
| 三角函数 `sin/cos/tan/asin/acos/atan/sinh/cosh/tanh` | libc 直调，O(1) |
| `exp/log/log10/is_finite/is_infinite/is_nan` | `log` 无 `$base` 参数（仅自然对数） |
| `bindec/hexdec/octdec/decbin/decoct/dechex/base_convert` | `base_convert` 精度受 64 字节缓冲限制（约 20 位十进制） |

### JSON / 哈希 / 密码 / 时间 {#func-data}

```php
class Main {
    public function main(): void {
        // JSON — 两趟法编码（计长→一次分配），零 concat 开销
        echo json_encode(["a" => 1, "b" => [2, 3]]);   // {"a":1,"b":[2,3]}
        $obj = json_decode('{"x":42}');                // 对象解析为关联数组
        var_dump($obj["x"]);                           // 42

        // 哈希 — 纯 C 算法（RFC 1321 / FIPS 180-4 / 查表法）
        echo md5("abc");                               // 900150983cd24fb0d6963f7d28e17f72
        echo sha256("abc");                            // ba7816bf...（64 字符小写 hex）
        echo hash_hmac("sha256", "data", "key");       // 支持 sha256/sha512

        // 密码 — bcrypt，与 PHP 完全兼容
        $hash = password_hash("secret", PASSWORD_BCRYPT, []);
        echo strlen($hash);                            // 60（$2b$10$...）
        var_dump(password_verify("secret", $hash));    // true

        // 时间
        echo time();                                   // Unix 时间戳
        echo date("Y-m-d H:i:s", time());              // 仅支持 Y/y/m/n/d/j/H/G/i/s 10 个格式符
        echo microtime();                              // 永远返回浮点秒（无参数）
    }
}
```

| 函数 | 差异 |
|------|------|
| `json_encode` | 无 `$flags`/`$depth`；NaN/Inf→`null`；`> 8MB` 返回 `"null"` |
| `json_decode` | 仅 1 参；对象解析为关联数组；失败返回 `NULL` |
| `md5/sha1/sha256/sha512/hash_hmac/crc32` | 无 `$binary` 参数（恒返回 hex 字符串） |
| `password_hash` | 仅 `PASSWORD_BCRYPT`；cost 硬编码 10；空密码抛错 |
| `password_verify` | 常量时间比较，防时序攻击；支持 `$2a/$2b/$2x/$2y` 前缀 |
| `date` | `timestamp < 0` 回退 `time()`；无时区支持 |
| `mktime` | 6 参数全必填；不归一化越界值 |
| `strtotime` | 仅支持 `Y-m-d`/`Y/m/d` + `H:i:s` 绝对格式；不支持相对/自然语言 |

### 随机 / 断言 {#func-random}

| 函数 | 差异 |
|------|------|
| `rand(int $min, int $max): int` | **强制 2 参**（不支持无参形式）；krng 伪随机 |
| `mt_rand(int $min, int $max): int` | 等同 `rand_int`，非真正 Mersenne Twister |
| `random_int(int $min, int $max): int` | 真 CSPRNG + 拒绝采样防模偏差；`min > max` 抛错 |
| `random_bytes(int $length): string` | 真 CSPRNG（Windows `rand_s` / Linux `/dev/urandom`）；`> 1048576` 抛错 |
| `assert_true/assert_false/assert_eq_int/assert_eq_float/assert_eq_str` | TinyPHP 自有断言，失败 `fprintf(stderr)` + `exit(2)` |

### 正则 PCRE {#func-pcre}

纯 C NFA VM 引擎（Russ Cox 模型，12 条指令，移植自 vlang），**按需 `#import pcre`**。内置 ReDoS 防护：回溯超限（`TP_BACKTRACK_LIMIT=1000000`）安全失败，恶意模式 `(a+)+$` 不会阻塞进程。

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

### 扩展函数 {#func-extensions}

| 扩展 | 函数数 | 说明 |
|------|-------|------|
| `pcntl` | 7 | 进程控制（fork/wait/signal…） |
| `posix` | 14 | POSIX 系统调用 |
| `pcre` | 8 | NFA VM 正则（见上） |
| `zlib` | 29 | gzip/zlib/deflate 压缩 + 流式 + 增量上下文 |
| `zip` | 18 | ZIP 归档读写 |
| `exif` | 8 | EXIF 图像元数据（纯 phpc 实现） |
| `calendar` | 16 | 日历转换（纯 tphp 实现） |
| `fileinfo` | 6 | MIME 类型检测 |
| `stream` | 21 | socket stream |
| `openssl` | 21 | TLS/加密 |
| `pdo` | 33 | PDO 统一 API + SQLite 驱动 |
| `pdo_mysql` | 0 | **无独立函数**（复用 PDO API），纯 C 协议 |
| `sqlite3` | 11 | 函数式 SQLite |
| `pgsql` | 78 | PostgreSQL（纯 C 协议） |
| `pdo_pgsql` | 3 | PostgreSQL PDO 驱动 |
| `curl` | 35 | HTTP 客户端（690 常量） |
| `ui` | 9 类+9 枚举 | 图形界面（sokol），可编译 Android APK |

### ⚠️ 部分支持项 {#func-partial}

- **curl Multi Handle**：11 个函数中 **6 个是 stub 抛 `Exception`**（`curl_multi_add_handle` / `curl_multi_exec` / `curl_multi_select` 等），无异步 I/O，用顺序 `curl_exec` 替代
- **curl Share Handle**：6 个中 2 个 stub（`curl_share_setopt` 等）
- **pdo_mysql**：0 个函数，全部走 PDO 统一 API
- **filter_var**：支持验证/净化过滤器与部分标志位

[查看完整函数列表与签名 → FUNCTIONS.md](https://github.com/KingBes/TinyPHP/blob/main/FUNCTIONS.md)
