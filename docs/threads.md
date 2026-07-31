## 多线程 {#threads}

TinyPHP 内置原生多线程支持，提供 Thread / Mutex / CondVar / WaitGroup 四类原语，可直接编译为 OS 线程。

```php
<?php
class Main {
    public function main(): void {
        $t = new Thread(function(): int {
            return 42;
        });
        $t->start();
        echo $t->join();  // 42

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

### 线程原语 {#primitives}

- **Thread** — `start` / `join` / `detach` + 静态 `yield` / `sleep` / `id`
- **Mutex** — `lock` / `tryLock` / `unlock`，支持 `recursive` 选项
- **CondVar** — `wait` / `signal` / `broadcast`
- **WaitGroup** — `add` / `done` / `wait`

> **Thread-Local 运行时策略：** 每线程独立内存池，无锁竞争，避免 GC STW 全局停顿。
