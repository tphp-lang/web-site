## 扩展系统 {#extensions}

通过 `#import` 指令导入内置扩展，扩展函数直接编译进二进制。

### #import 语法 {#import-syntax}

```php
<?php
#import pcntl

class Main {
    public function main(): void {
        $pid = pcntl_fork();
    }
}
```

### 内置扩展 {#builtin-exts}

<div class="tag-cloud">
    <span class="bny-tag" color="blue">pcntl</span>
    <span class="bny-tag" color="blue">posix</span>
    <span class="bny-tag" color="blue">openssl</span>
    <span class="bny-tag" color="blue">calendar</span>
    <span class="bny-tag" color="blue">exif</span>
    <span class="bny-tag" color="blue">pcre</span>
    <span class="bny-tag" color="blue">pdo</span>
    <span class="bny-tag" color="blue">pdo_mysql</span>
    <span class="bny-tag" color="blue">sqlite3</span>
    <span class="bny-tag" color="blue">stream</span>
    <span class="bny-tag" color="blue">fileinfo</span>
    <span class="bny-tag" color="blue">filter</span>
    <span class="bny-tag" color="blue">hash</span>
    <span class="bny-tag" color="blue">iconv</span>
</div>

> **安全模型：** `#import` 受扩展名白名单（正则 `\w[\w\-]*`）+ 工作区边界校验（realpath 后必须在 `ext/` 目录内）双重约束，杜绝路径穿越。
