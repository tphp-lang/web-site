## 面向对象 {#oop}

> tphp 的对象作用域结束时自动调用 `__destruct`。<br>
> 本章假设你已读过 [intro](docs/intro.md)、[basics](docs/basics.md)、[control-flow](docs/control-flow.md)、[functions](docs/functions.md)。<br>
> 类布局编译期固定，不支持动态属性、`__call`/`__get`/`__set`、`clone`、`Reflection*`，详见各小节限制说明。

### 类与属性 {#class}

用 `class` 关键字声明类，**属性类型必填**（`public $x` 会被拒绝）。方法通过 `visibility function name(params): retType { ... }` 声明，返回类型可省略（默认 `void`）。方法体内可用 `$this` 访问当前实例，`self::` 引用当前类，`parent::` 调用父类成员。

```php
class Point {
    public int $x;           // 属性类型必填
    public int $y;
    const string UNIT = "pt"; // 类常量类型也必填

    public function __construct(int $x, int $y) {
        $this->x = $x;        // $this 指向当前实例
        $this->y = $y;
    }

    public function label(): string {
        return self::UNIT . "({$this->x},{$this->y})";  // self:: 引用本类常量
    }
}

class OffsetPoint extends Point {
    public function __construct(int $x, int $y) {
        parent::__construct($x, $y);   // parent:: 调用父类构造器
    }
}
```

| 元素 | 语法 | 说明 |
|------|------|------|
| 属性 | `public type $name [= expr];` | 类型必填；readonly 禁止默认值 |
| 方法 | `public function name(params): ret {}` | 返回类型可省略（默认 void） |
| 类常量 | `const type NAME = expr;` | 类型必填（与全局常量可选不同） |
| `$this` | 仅实例方法内可用 | 指向当前对象 |
| `self::` | 引用当前类 | 常量、静态方法（实例方法也可） |
| `parent::` | 调用父类成员 | 父类构造器/方法 |

> ⚠️ **可见性**：仅支持 `public` / `private`，**不支持 `protected`**。
> ⚠️ **`static` 属性**：语法接受 `public static int $x = 0;`，但 `static` 标志当前会**丢失**（按实例属性处理）。仅内置类（Thread/Parallel/Enum）支持真静态。
> ⚠️ **`final` 方法**：不支持，写 `final public function` 报语法错误；`final` 仅修饰类。
> ⚠️ **`abstract` 方法**：语法接受但不强制子类实现（无编译期/运行期检查）。

### 继承与接口 {#inheritance}

`extends` 单继承，子类继承父类的所有属性与方法；`interface` 声明接口契约，`implements` 实现一个或多个接口。`abstract class` 与 `final class` 修饰类级别——`abstract` 不强制子类实现抽象方法，`final` 仅作为标记（无运行时检查）。

```php
interface Drawable {
    public function draw(): void;   // 接口方法签名
}

interface Printable {
    public function toString(): string;
}

abstract class Shape {
    public string $name;
    public function __construct(string $name) {
        $this->name = $name;
    }
    public function describe(): string {
        return "Shape: {$this->name}";
    }
}

final class Circle extends Shape implements Drawable, Printable {
    public float $radius;

    public function __construct(string $name, float $radius) {
        parent::__construct($name);
        $this->radius = $radius;
    }

    public function draw(): void {           // 实现 Drawable
        echo "draw circle {$this->name}\n";
    }

    public function toString(): string {     // 实现 Printable
        return $this->describe() . " r={$this->radius}";
    }
}
```

| 形式 | 语法 | 说明 |
|------|------|------|
| 继承 | `class B extends A {}` | 单继承 |
| 接口声明 | `interface I { ... }` | 仅方法签名 |
| 实现 | `class B implements I, J {}` | 可实现多个接口 |
| 抽象类 | `abstract class A {}` | 不能 `new A()`（语法层） |
| 终态类 | `final class A {}` | 仅类级别标记（无运行时检查） |

> ⚠️ **接口语义限制**：`implements ArrayAccess` / `Iterator` / `Stringable` 等**仅记录类型关系，不生效**——`offsetGet`/`rewind`/`__toString` 等需运行时动态分派，AOT 不可行。foreach 只支持 `array` 和 `Generator`。
> ⚠️ **`abstract` 方法**：语法接受 `abstract public function foo();`，但**不强制**子类实现（无检查）。如需契约保证，应在设计层显式约定。

### 构造器与析构 {#construct}

`__construct` 是构造器，支持**构造器属性提升**——在参数列表中写 `public type $var` 可同时声明属性并赋值，免去手写 `$this->x = $x;`。`__destruct` 是析构器，**禁止写返回类型**，在对象作用域结束时自动调用（如函数返回、`unset`、程序退出）。

```php
class User {
    // 构造器属性提升：参数即属性
    public function __construct(
        public int $id,
        public string $name,
        public readonly string $role = "guest"   // 提升属性可带 readonly / 默认值
    ) {}

    public function __destruct() {
        echo "user {$this->name} destroyed\n";
    }
}

class Main {
    public function main(): void {
        $u = new User(1, "alice", "admin");
        echo "{$u->id}: {$u->name} ({$u->role})\n";
        // main() 结束时 $u 离开作用域，自动调用 __destruct
    }
}
```

| 方法 | 签名 | 必须 | 说明 |
|------|------|------|------|
| `__construct` | `(public type $x, ...)` | 否 | 支持属性提升；可省略 |
| `__destruct` | `()` | 否 | 禁止写返回类型；作用域结束自动调用 |

> 构造器属性提升的参数**必须**写类型声明（与普通属性一致），`public $x` 会被拒绝。
> `Main` 入口类的 `__construct(int $argc, array $argv)` 接收命令行参数，可省略。

### Trait {#trait}

Trait 是代码复用单元，引入到使用类后与类自身成员等价，无额外运行时开销。用 `use A, B;` 引入多个 trait；多 trait 同名方法时**必须**用 `insteadof` / `as` 显式解决冲突，否则编译报错。

```php
trait Hello {
    public function say(): void {
        echo "Hello, {$this->name}\n";   // trait 方法内 $this 指向使用类实例
    }
    public function foo(): void { echo "Hello.foo\n"; }
}

trait World {
    public function greet(): void { echo "World\n"; }
    public function foo(): void { echo "World.foo\n"; }
}

class User {
    public string $name;
    public function __construct(string $name) { $this->name = $name; }

    use Hello, World {
        Hello::foo insteadof World;     // foo 用 Hello 版本，排除 World 的
        World::foo as worldFoo;          // 为 World::foo 创建别名 worldFoo
        Hello::say as private sayPriv;   // 改可见性（语法接受，无运行时检查）
    }
}

class Main {
    public function main(): void {
        $u = new User("alice");
        $u->say();        // Hello, alice
        $u->greet();      // World
        $u->foo();        // Hello.foo（World::foo 被 insteadof 排除）
        $u->worldFoo();   // World.foo（别名仍可用）
    }
}
```

| 规则 | 说明 |
|------|------|
| `A::foo insteadof B` | 排除 B 的 `foo`，使用 A 的版本 |
| `A::foo as aFoo` | 创建别名（即使被 `insteadof` 排除，别名仍会创建） |
| `A::bar as private bBar` | 改可见性（语法接受，无运行时可见性检查） |
| 属性/常量冲突 | 直接报错（无隐式覆盖，需调整设计） |
| `$this` | trait 方法内指向使用类实例，可访问类自身属性 |
| 类成员优先 | 类自身成员**优先**于 trait 成员（覆盖语义，无警告） |

> ⚠️ **不支持**：trait 静态属性、trait 组合（trait use trait）、抽象 trait 方法。
> Trait 内可含方法、属性、类常量，与类成员语法一致。

### Enum 枚举 {#enum}

`enum` 声明枚举类型，用 `: backing_type` 指定 backing 类型（`int` 或 `string`），用 `case` 声明枚举值。枚举值是单例对象。

```php
enum Status: int {
    case Active = 1;
    case Inactive = 0;
    case Banned = -1;
}

enum Direction: string {
    case Up = "up";
    case Down = "down";
    case Left = "left";
    case Right = "right";
}

class Main {
    public function main(): void {
        $s = Status::Active;
        echo $s->name . "\n";       // Active（枚举名）
        echo $s->value . "\n";      // 1（backing 值）

        $d = Direction::from("up");  // 由 backing 值取枚举
        echo $d->name . "\n";       // Up
    }
}
```

| 元素 | 语法 | 说明 |
|------|------|------|
| 声明 | `enum Name: int\|string { ... }` | backing 类型必填 |
| case | `case Ident = expr;` | 枚举值必须显式赋值 |
| `->name` | 返回 case 名字符串 | `Status::Active->name` → `"Active"` |
| `->value` | 返回 backing 值 | `Status::Active->value` → `1` |
| `Enum::from($v)` | 由 backing 值取枚举 | 类型不匹配抛异常 |

> Enum 是内置真静态类，`enum Status::Active` 等枚举值可直接通过 `::` 访问。
> 不支持纯枚举（无 backing 的 `enum Foo {}`），backing 类型必须显式声明。

### 匿名类 {#anon-class}

`new class [(args)] [extends Parent] [implements Iface] { members }` 声明匿名类，与普通类在行为上完全等价。构造参数 `(args)` 位于 `class` 关键字后、`extends` 前（PHP 8.3 语法顺序）。

```php
class Base {
    public int $base;
    public function __construct(int $base) { $this->base = $base; }
}

class Main {
    public function main(): void {
        // 简单匿名类
        $obj = new class {
            public function greet(): void { echo "hello\n"; }
        };
        $obj->greet();    // hello

        // 带构造参数 + 继承
        $obj2 = new class(42) extends Base {
            public int $extra;
            public function __construct(int $base) {
                parent::__construct($base);
                $this->extra = $base * 2;
            }
        };
        echo $obj2->extra . "\n";   // 84

        // 实现接口（直接通过匿名类变量调用）
        $obj3 = new class implements Runnable {
            public function run(): void { echo "running\n"; }
        };
        $obj3->run();   // running
    }
}

interface Runnable {
    public function run(): void;
}
```

> ⚠️ **`get_class()` 返回的类名形如 `class@anonymous-N`**（与 PHP 原生 `class@anonymous` 略有差异）。
> ⚠️ **不支持 `use($x, $y)` 捕获语法**（与显式类型哲学冲突；可用构造器属性提升替代）。
> ⚠️ **接口分派限制**：通过接口类型变量调用方法（如 `$obj: Bar = new class implements Bar {...}; $obj->method()`）当前**不支持**。直接通过匿名类变量调用方法可用。

### Property Hook 属性钩子 {#property-hook}

Property Hook（PHP 8.4）为属性定义 getter/setter。`get => expr;` 是短形式 get，`set => expr;` 是短形式 set（`$value` 代表赋入的新值），也可用 `get { stmts }` / `set { stmts }` 块形式。属性访问 `$obj->prop` 和赋值 `$obj->prop = val` 会**自动改写**为 getter/setter 调用。

```php
class User {
    public string $name {
        get => strtoupper($this->name);     // 短形式 get，$this->name 直接访问 backing field
        set => strtolower($value);          // 短形式 set，$value 是赋入的新值
    }

    public int $age {
        get { return $this->age; }          // 块形式 get
        set {                                // 块形式 set，需自行赋值
            if ($value < 0) {
                $value = 0;
            }
            $this->age = $value;
        }
    }

    public function __construct(string $name, int $age) {
        $this->name = $name;   // 触发 set hook
        $this->age = $age;     // 触发 set hook
    }
}

class Main {
    public function main(): void {
        $u = new User("Alice", 30);
        echo $u->name . "\n";   // ALICE（触发 get hook）
        echo $u->age . "\n";    // 30
        $u->age = -5;
        echo $u->age . "\n";    // 0（set hook 截断负值）
    }
}
```

| 形式 | 语法 | 说明 |
|------|------|------|
| 短形式 get | `get => expr;` | 返回 `expr` 的值 |
| 块形式 get | `get { stmts; return expr; }` | 多语句，须显式 return |
| 短形式 set | `set => expr;` | `$value` 为新值，`expr` 结果存入 backing field |
| 块形式 set | `set { stmts }` | 须自行执行 `$this->prop = $value;` |

> hook 体内 `$this->prop` 直接访问 backing field，避免递归调用 hook。
> **支持继承**：子类访问父类的 hooked 属性时，调用父类的 getter/setter。

### readonly 与空安全 {#readonly}

`readonly` 修饰属性或整个类，限制只能在声明它的类的 `__construct` 内赋值**一次**。`?->` 是空安全调用——左侧为 `null` 时短路返回 `null`，不触发方法调用。`instanceof` 判断对象是否为某类（或其子类）实例。

```php
readonly class Config {                 // readonly class：所有属性自动 readonly
    public function __construct(
        public string $env,
        public int $timeout,
        public array<string> $hosts
    ) {}
}

class Logger {
    public mixed $cfg = null;            // 用 mixed 持有可能为 null 的对象（?T 不支持）

    public function env(): string {
        // ?-> 空安全：$this->cfg 为 null 时短路返回 null，不调用 ->env
        return $this->cfg?->env ?? "default";
    }
}

class Animal {}
class Dog extends Animal {}

class Main {
    public function main(): void {
        $cfg = new Config("prod", 30, ["a.com", "b.com"]);
        // $cfg->env = "dev";   // ❌ 编译错误：readonly 属性只能在 __construct 内赋值

        $logger = new Logger();
        echo $logger->env() . "\n";   // default（cfg 为 null，?-> 短路）

        $logger->cfg = $cfg;
        echo $logger->env() . "\n";   // prod

        $d = new Dog();
        var_dump($d instanceof Animal);   // true（遍历类链）
        var_dump($d instanceof Dog);     // true
        var_dump($cfg instanceof Animal); // false
    }
}
```

| 特性 | 语法 | 说明 |
|------|------|------|
| readonly 属性 | `public readonly int $x;` | 仅可在本类 `__construct` 内赋值一次 |
| readonly class | `readonly class C {}` | 所有属性自动 readonly |
| `?->` | `$obj?->method()` | 左侧 null 时短路返回 null，不调用 |
| `instanceof` | `$obj instanceof Class` | 判断对象是否为目标类或其子类实例 |

> ⚠️ **readonly 限制**：
> - readonly 属性**不能有默认值**（`public readonly int $x = 0;` 报错）。
> - 不支持 `static readonly`（PHP 8.2 禁止）。
> - readonly 属性只能在本类构造器赋值，子类构造器不能直接写父类的 readonly 属性。
>
> ⚠️ **可空类型**：tphp **不支持 `?T` 可空类型语法**（破坏类型固定优势），无论属性、参数还是返回类型。需要表示"可能为 null 的对象"时，用 `mixed` 持有（`public mixed $cfg = null;`），配合 `?->` 空安全访问。
>
> `instanceof` 判断对象是否为目标类或其子类实例。
