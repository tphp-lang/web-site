## 多线程与异步 {#threads}

TinyPHP 内置原生多线程与异步通信支持：`Thread`/`Mutex`/`CondVar`/`WaitGroup` 四类线程原语 + `Channel`/`Future`/`chan_select` 三类异步原语（参考 vlang CSP 模型），全部可直接编译为 OS 线程/协程通信。

> 采用 **Thread-Local 运行时**策略：每线程独立、无锁竞争。

```php
<?php
class Main {
    public function main(): void {
        $t = new Thread(function(): int { return 42; });
        $t->start();
        echo $t->join();   // 42

        $wg = new WaitGroup();
        $wg->add(1);
        $t2 = new Thread(function() use ($wg): int {
            $wg->done();
            return 0;
        });
        $t2->start();
        $wg->wait();
        $t2->join();

        $mutex = new Mutex(false);
        $mutex->lock();
        // 临界区
        $mutex->unlock();
    }
}
```

### Thread {#thread}

| 方法 | 签名 | 说明 |
|------|------|------|
| `__construct` | `(callable $fn): void` | 接收闭包（须返回 `int` 作为线程退出码） |
| `start` | `(): bool` | 创建 OS 线程；成功返回 `true` |
| `join` | `(): int` | 等待线程结束，返回退出码；未启动/已结束返回缓存的退出码 |
| `detach` | `(): bool` | 分离线程（结束后自动回收）；析构时仍运行自动 detach |
| `yield` (静态) | `(): void` | 让出 CPU 时间片 |
| `sleep` (静态) | `(float $seconds): void` | 秒级休眠（支持小数，即毫秒/微秒） |
| `id` (静态) | `(): int` | 当前线程 ID |

### Mutex / CondVar / WaitGroup {#primitives}

| 类 | 方法 | 说明 |
|----|------|------|
| `Mutex` | `__construct(bool $recursive = false)` | `recursive=true` 创建递归锁；`false` 更轻量 |
| | `lock(): bool` / `tryLock(): bool` / `unlock(): bool` | 阻塞加锁 / 非阻塞（已锁定返回 false）/ 解锁 |
| `CondVar` | `__construct(): void` | 条件变量 |
| | `wait(Mutex $m): bool` | 原子释放锁并阻塞，唤醒后重新加锁 |
| | `signal(): bool` / `broadcast(): bool` | 唤醒一个 / 唤醒所有 |
| `WaitGroup` | `__construct(): void` | 计数信号量 |
| | `add(int $delta): void` / `done(): void` / `wait(): void` | 增减计数（可为负）/ 完成减一 / 阻塞到计数归零 |

### 线程安全模型 {#thread-safety}

> 线程间只能传递值类型（int/float/bool）或堆分配数据，无锁竞争。

### 异步与协程通信 {#async}

#### Channel {#channel}

CSP 风格有界通道，容量构造时固定：

| 方法 | 签名 | 说明 |
|------|------|------|
| `__construct` | `(int $capacity): void` | 创建固定容量通道 |
| `push` | `(mixed $v): void` | 阻塞入队：满则等待；**close 后抛 `ChannelClosedException`** |
| `pop` | `(): mixed` | 阻塞出队：空则等待；通道已关闭且无元素返回 `null` |
| `tryPush` | `(mixed $v): bool` | 非阻塞入队：满立即返回 `false`；close 后抛异常 |
| `tryPop` | `(): mixed` | 非阻塞出队：空立即返回 `null` |
| `close` | `(): void` | 关闭通道并唤醒所有等待者 |
| `isClosed` / `length` / `capacity` | `(): bool` / `(): int` / `(): int` | 查询通道状态 |

#### Future {#future}

一次性异步结果，状态机 PENDING → RESOLVED / REJECTED：

| 方法 | 签名 | 说明 |
|------|------|------|
| `create` (静态) | `(): Future` | 创建 PENDING Future |
| `resolve` | `(mixed $v): void` | 标记为 RESOLVED 并唤醒等待者 |
| `reject` | `(mixed $err): void` | 标记为 REJECTED 并唤醒等待者 |
| `await` | `(): mixed` | 阻塞等待结果；resolve 返回 result；**reject 抛 `FutureRejectedException`** |
| `isReady` / `isRejected` | `(): bool` | 查询当前状态 |
| `then` | `(callable $cb): Future` | 链式回调：resolve 时调 `$cb(result)` 写入新 Future，reject 透传 |
| `catch` | `(callable $cb): Future` | 错误恢复：reject 时调 `$cb(error)`，resolve 透传 |
| `all` (静态) | `(array $futures): Future` | 全部 resolve 则 resolve 数组，任一 reject 则整体 reject |
| `race` (静态) | `(array $futures): Future` | 任一完成即转发结果/错误 |

#### chan_select {#chan-select}

```php
function chan_select(array $channels, int $timeout_ms = -1): int {}
```

| 返回值 | 含义 |
|--------|------|
| `>= 0` | 就绪通道索引（有元素可 pop 或已关闭） |
| `-1` | 超时（`timeout_ms > 0` 生效） |
| `-2` | 所有通道都已关闭 |

> `timeout_ms = -1` 表示无限等待。

#### 异步示例 {#async-example}

```php
<?php
class Main {
    public function main(): void {
        // Channel 跨线程通信
        $ch = new Channel(4);
        $t = new Thread(function() use ($ch): int {
            $ch->push(42);
            $ch->close();
            return 0;
        });
        $t->start();
        $v = $ch->pop();   // 42
        $t->join();

        // Future 链式回调
        $f = Future::create();
        $f->resolve(10);
        $doubled = $f->then(fn(mixed $x): mixed => $x * 2);
        echo $doubled->await();   // 20

        // chan_select 多路复用
        $ch1 = new Channel(4);
        $ch2 = new Channel(4);
        $ch2->push("hello");
        $idx = chan_select([$ch1, $ch2], 100);   // 1
    }
}
```

#### 异常与内存安全 {#async-safety}

| 异常 | 抛出场景 | 父类 |
|------|----------|------|
| `ChannelClosedException` | `push`/`tryPush` 到已关闭的 Channel | `Exception` |
| `FutureRejectedException` | `await` 被 reject 的 Future | `Exception` |

- 即使忘记 `close()`，Channel 也会自动释放剩余元素；Future 自动释放 result/error，**无内存泄漏**

### 平台支持 {#thread-platforms}

| 平台 | TCC | GCC / Clang |
|------|-----|-------------|
| Windows x86_64 | ✅ | ✅ |
| Linux x86_64 / aarch64 | ✅ | ✅ |
| macOS aarch64 | ✅ | ✅ |
