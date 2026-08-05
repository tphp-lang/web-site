## 多线程与异步 {#threads}

TinyPHP 内置原生多线程与异步通信支持：`Thread`/`Mutex`/`CondVar`/`WaitGroup` 四类线程原语 + `Channel`/`Future`/`chan_select` 三类异步原语（参考 vlang CSP 模型），全部可直接编译为 OS 线程/协程通信。

> 基于 tinycthread（zlib license）跨平台线程库。采用 **Thread-Local 运行时**策略：每线程独立内存池，无锁竞争，避免 GC 全局停顿。

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
| `__construct` | `(callable $fn): void` | 接收闭包（须返回 `int` 作为线程退出码）；副本堆分配，start 后转交子线程 |
| `start` | `(): bool` | 创建 OS 线程；成功返回 `true` |
| `join` | `(): int` | 等待线程结束，返回退出码；未启动/已结束返回缓存的 ret |
| `detach` | `(): bool` | 分离线程（结束后自动回收）；析构时仍运行自动 detach |
| `yield` (静态) | `(): void` | 让出 CPU 时间片 |
| `sleep` (静态) | `(float $seconds): void` | 秒级休眠（支持小数，即毫秒/微秒） |
| `id` (静态) | `(): int` | 当前线程 ID（Win: `GetCurrentThreadId` / POSIX: `pthread_self`） |

### Mutex / CondVar / WaitGroup {#primitives}

| 类 | 方法 | 说明 |
|----|------|------|
| `Mutex` | `__construct(bool $recursive = false)` | `recursive=true` 用 CRITICAL_SECTION；`false` 用 SRWLOCK（更轻量） |
| | `lock(): bool` / `tryLock(): bool` / `unlock(): bool` | 阻塞加锁 / 非阻塞（已锁定返回 false）/ 解锁 |
| `CondVar` | `__construct(): void` | Win: CONDITION_VARIABLE / POSIX: pthread_cond_t |
| | `wait(Mutex $m): bool` | 原子释放锁并阻塞，唤醒后重新加锁 |
| | `signal(): bool` / `broadcast(): bool` | 唤醒一个 / 唤醒所有（已修复 tinycthread POSIX bug） |
| `WaitGroup` | `__construct(): void` | 单 u64 state（高32位任务数 + 低32位等待数）+ Semaphore |
| | `add(int $delta): void` / `done(): void` / `wait(): void` | 增减计数（可为负）/ 完成减一 / 阻塞到计数归零 |

### 线程安全模型 {#thread-safety}

| 机制 | 说明 |
|------|------|
| Thread-Local 运行时 | 每线程独立 `str_pool`（128KB Arena）/`arr_freelist`（128 槽）/`obj_freelist`（128 槽），无锁竞争 |
| TCC+Windows TLS | TCC 不支持 `_Thread_local`/`__declspec(thread)`，`compat/tls.h` 用 Windows TLS API（TlsAlloc/TlsGetValue/TlsSetValue）实现真正线程隔离 |
| GCC/Clang/MSVC | 直接用 `_Thread_local`（性能更好） |
| 闭包跨线程传递 | `t_callback {func, env}` 堆分配副本传子线程，`_tphp_thread_entry` 适配器调用后释放 |
| 子线程清理 | 退出时调 `tphp_thread_cleanup()` 释放 TLS 内存池 |

> 线程间只能传递值类型（int/float/bool）或堆分配数据，无锁竞争。

### 异步与协程通信 {#async}

> 基于 tinycthread 的 mutex + condvar。**自旋 750 次 + 阻塞**混合策略减少 syscall；Channel 用固定容量环形缓冲区，push/pop **零 malloc**。

#### Channel {#channel}

CSP 风格有界通道，容量构造时固定：

| 方法 | 签名 | 说明 |
|------|------|------|
| `__construct` | `(int $capacity): void` | 分配环形缓冲区 + mutex/condvar |
| `push` | `(mixed $v): void` | 阻塞入队：满则自旋 750 次 → wait；**close 后抛 `ChannelClosedException`** |
| `pop` | `(): mixed` | 阻塞出队：空则检查 is_closed（关闭返回 `null`）→ wait |
| `tryPush` | `(mixed $v): bool` | 非阻塞入队：满立即返回 `false`；close 后抛异常 |
| `tryPop` | `(): mixed` | 非阻塞出队：空立即返回 `null` |
| `close` | `(): void` | 置 closed → broadcast 唤醒所有等待者；剩余元素由 dtor 释放 |
| `isClosed` / `length` / `capacity` | `(): bool` / `(): int` / `(): int` | 无锁原子读 |

#### Future {#future}

一次性异步结果，状态机 PENDING → RESOLVED / REJECTED（原子转换）：

| 方法 | 签名 | 说明 |
|------|------|------|
| `create` (静态) | `(): Future` | 创建 PENDING Future |
| `resolve` | `(mixed $v): void` | CAS PENDING→RESOLVED + broadcast |
| `reject` | `(mixed $err): void` | CAS PENDING→REJECTED + broadcast |
| `await` | `(): mixed` | 自旋 750 次 → wait；resolve 返回 result；**reject 抛 `FutureRejectedException`** |
| `isReady` / `isRejected` | `(): bool` | 原子读 state |
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

> spin 循环遍历 channels，间隔 `thrd_yield` 避免空转；`timeout_ms = -1` 无限等待。

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

- 即使忘记 `close()`，Channel dtor 也会释放剩余元素；Future dtor 释放 result/error，**无内存泄漏**
- push/resolve 时元素 `_arr_val_retain`（+1 引用）；pop/await 不额外 retain（调用方管理返回值生命周期）
- `isReady`/`isClosed`/`length` 无锁原子读；`thrd_yield` 避免 chan_select 空转

### 平台支持 {#thread-platforms}

| 平台 | TCC | GCC / Clang |
|------|-----|-------------|
| Windows x86_64 | ✅ Win32 线程 + TLS API | ✅ Win32 线程 + `_Thread_local` |
| Linux x86_64 / aarch64 | ✅ pthread + `_Thread_local` | ✅ pthread + `_Thread_local` |
| macOS aarch64 | ✅ pthread + `_Thread_local` | ✅ pthread + `_Thread_local` |
