## 扩展系统 {#extensions}

对标 PHP extension，通过 `#import` 指令**按需引入**内置扩展，扩展函数直接编译进原生二进制，未引入的扩展零开销。

### #import 语法 {#import-syntax}

```php
<?php
#import pcntl            // 引入进程控制扩展

class Main {
    public function main(): void {
        $pid = pcntl_fork();
        if ($pid === 0) {
            echo "child\n";
        }
    }
}
```

### ext/ 扩展清单 {#ext-list}

<div class="tag-cloud">
    <span class="bny-tag" color="blue">pcntl</span>
    <span class="bny-tag" color="blue">posix</span>
    <span class="bny-tag" color="blue">pcre</span>
    <span class="bny-tag" color="blue">stream</span>
    <span class="bny-tag" color="blue">openssl</span>
    <span class="bny-tag" color="blue">curl</span>
    <span class="bny-tag" color="blue">sqlite3</span>
    <span class="bny-tag" color="blue">pdo</span>
    <span class="bny-tag" color="blue">pdo_mysql</span>
    <span class="bny-tag" color="blue">pdo_pgsql</span>
    <span class="bny-tag" color="blue">pgsql</span>
    <span class="bny-tag" color="blue">exif</span>
    <span class="bny-tag" color="blue">calendar</span>
    <span class="bny-tag" color="blue">fileinfo</span>
    <span class="bny-tag" color="blue">gd</span>
    <span class="bny-tag" color="blue">ui</span>
</div>

| 扩展 | 函数数 | 说明 |
|------|-------|------|
| `pcntl` | 7 | 进程控制（fork/wait/signal…） |
| `posix` | 14 | POSIX 系统调用 |
| `pcre` | 8 | NFA VM 正则引擎（自带 ReDoS 防护） |
| `stream` | 21 | socket stream |
| `openssl` | 21 | TLS/加密 |
| `curl` | 35 | HTTP 客户端（690 常量） |
| `sqlite3` | 11 | 函数式 SQLite（内置 3.46.0 amalgamation 静态编译） |
| `pdo` | 33 | PDO 统一 API + SQLite 驱动 |
| `pdo_mysql` | 0 | MySQL 驱动（纯 C 协议，复用 PDO API） |
| `pdo_pgsql` | 3 | PostgreSQL PDO 驱动 |
| `pgsql` | 78 | PostgreSQL（纯 C 协议） |
| `exif` | 8 | EXIF 图像元数据（纯 phpc 实现） |
| `calendar` | 16 | 日历转换（纯 tphp 实现） |
| `fileinfo` | 6 | MIME 类型检测 |
| `gd` | — | 图像处理 |
| `ui` | 9 类 + 9 枚举 | 图形界面（sokol），可编译 Android APK |

> `demo` 目录为扩展开发示例，非正式扩展。`curl` 的 Multi/Share 句柄部分函数为 stub（见 [内置函数](builtins.md)）。

### include/ 内置扩展 {#include-exts}

以下扩展随 C 运行时**常驻编译**，**无需 `#import`**：

<div class="tag-cloud">
    <span class="bny-tag" color="green">zlib</span>
    <span class="bny-tag" color="green">zip</span>
    <span class="bny-tag" color="green">filter</span>
    <span class="bny-tag" color="green">hash</span>
    <span class="bny-tag" color="green">iconv</span>
    <span class="bny-tag" color="green">mbstring</span>
    <span class="bny-tag" color="green">ctype</span>
    <span class="bny-tag" color="green">json</span>
    <span class="bny-tag" color="green">password</span>
    <span class="bny-tag" color="green">random</span>
</div>

| 扩展 | 函数数 | 说明 |
|------|-------|------|
| `zlib` | 29 | gzip/zlib/deflate 压缩 + 流式 + 增量上下文；依赖系统 zlib 库，自动检测链接（Linux/macOS `-lz`；Windows+TCC 直链 zlib1.dll） |
| `zip` | 18 | ZIP 归档读写 |
| `filter` | 3 | `filter_var` 验证/净化过滤器 |
| `hash` | 5 | md5/sha1/sha256/sha512/crc32（纯 C 实现） |
| `iconv` | 8 | 字符集转换 |
| `mbstring` | 3 | UTF-8 多字节字符串 |
| `ctype` | 11 | 字符检测 |
| `json` | 3 | json_encode/decode/validate |
| `password` | 2 | bcrypt 密码哈希 |
| `random` | 4 | CSPRNG 随机数 |

> 错误契约：zlib/zip/sqlite3/pdo 等扩展错误统一抛 `Exception`（可 try-catch），不返回 `false`，符合 AOT 单返回类型契约。

### 代表扩展示例 {#examples}

**sqlite3（函数式 API）**：

```php
#import sqlite3

class Main {
    public function main(): void {
        int $db = sqlite_open(":memory:");
        sqlite_exec($db, "CREATE TABLE users(id INTEGER PRIMARY KEY, name TEXT)");
        sqlite_exec($db, "INSERT INTO users(name) VALUES('Alice')");
        echo sqlite_last_insert_rowid($db);            // 1
        $rows = sqlite_query($db, "SELECT * FROM users");
        var_dump($rows);                               // array<array<string>>
        sqlite_close($db);
    }
}
```

> AOT 类型安全说明：数据库句柄以 `int` 存储（指针转 int）；查询结果统一 `array<array<string>>`；NULL 值返回空字符串。

**pdo（统一 API + SQLite 驱动）**：

```php
#import pdo

class Main {
    public function main(): void {
        $pdo = new PDO("sqlite::memory:");
        $pdo->exec("CREATE TABLE t(id INTEGER, name TEXT)");
        $stmt = $pdo->prepare("INSERT INTO t VALUES(?, ?)");
        $stmt->execute([1, "hello"]);
        foreach ($pdo->query("SELECT * FROM t") as $row) {
            var_dump($row);       // FETCH_ASSOC
        }
    }
}
```

> PDO 支持 SQLite / MySQL（`pdo_mysql`，纯 C 协议）/ PostgreSQL（`pdo_pgsql`）三种驱动；`bindValue`/`fetchColumn` 等按类型拆分（bindValueInt/bindValueStr）。

**curl（HTTP 客户端）**：

```php
#import stream
#import openssl
#import curl

class Main {
    public function main(): void {
        $ch = curl_init("http://httpbin.org/get");
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);
        curl_exec($ch);
        $body = curl_multi_getcontent($ch);
        $info = curl_getinfo($ch);
        echo "HTTP " . $info["http_code"] . ", " . strlen($body) . " bytes\n";
        curl_close($ch);
    }
}
```

### 安全模型 {#security}

为防止注入攻击，所有预处理指令受安全约束：

| 指令 | 机制 | 说明 |
|------|------|------|
| `#import` | 扩展名白名单 | 正则 `\w[\w\-]*`，仅接受字母/数字/下划线/连字符 |
| | 工作区边界校验 | `realpath()` 后验证路径在 `ext/` 目录内，杜绝路径穿越 |
| `#flag` | Shell 元字符阻断 | `` ` `` `$` `|` `;` `&` `>` `<` `\n` `\` 直接报错 |
| | Flag 前缀白名单 | 仅 `-I -L -l -D -U -O -W -std -m -f -g -pthread -static -shared -B` |
| | 危险 Flag 黑名单 | `-fplugin` / `-specs` / `-wrapper` / `-ld=` 直接报错（防 GCC 插件注入） |
| | 路径规范化 | `-I`/`-L` 路径经 `realpath()` 消解 `../` |
| `#include` | realpath + 边界校验 | 项目头路径验证在项目根目录内 |
| | 系统头白名单 | `#include <...>` 仅允许标准 C 库 + 常见 POSIX/Windows 头 |

### ui 图形扩展 {#ui}

基于 sokol 的跨平台图形界面扩展（`#import ui`）：

- **绘图**：App/Window/Graphics 2D 绘图
- **控件**：Button/Label/TextBox/CheckBox/Slider Widget 体系
- **布局**：Stack/CanvasLayout；事件系统 + 软键盘桥接
- **后端**：Windows/Linux → OpenGL，macOS → Metal，Android → GLES3
- **Android**：NDK 交叉编译打包 APK（`-os android`），含 JNI 软键盘、触摸事件转换、原生按键拦截

```bash
tphp test/ui/ui_basic.php -os android     # 编译 4 ABI → xxx-debug.apk
```
