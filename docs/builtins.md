## 内置函数 {#builtins}

312+ 内置函数，覆盖 PHP 标准库核心子集，全部以 AOT 编译进原生二进制。

### 函数分类 {#func-categories}

- **数组** — `array_*` / `count` / `sort` / `push` / `merge` / `splice`
- **字符串** — `strlen` / `substr` / `str_replace` / `sprintf` / `explode` / `implode`
- **数学** — `abs` / `ceil` / `floor` / `round` / `max` / `min` / `pow` / `sqrt` / `log` / `exp` / `trig`
- **时间** — `time` / `date` / `mktime` / `strtotime`
- **JSON** — `json_encode` / `json_decode`
- **哈希** — `md5` / `sha1` / `sha256` / `hash` / `hmac` / `password_hash` / `password_verify`
- **PCRE 正则** — `preg_match` / `preg_replace` / `preg_split`（NFA VM）
- **iconv** 字符集转换
- **filter_var** 过滤器
- **多线程** — `Thread` / `Mutex` / `CondVar` / `WaitGroup`
- **zlib** gzip 压缩 + 流式 + 增量上下文
- **zip** 归档读写
- **stream / socket / stream**
- **CSPRNG** — `random_bytes` / `random_int`
- **ctype**

[查看完整函数列表](https://github.com/KingBes/TinyPHP/blob/main/FUNCTIONS.md)
