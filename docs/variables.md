## tphp 变量 {#tphp-variables}

PHP 变量规则：

- 变量以 $ 符号开始，后面跟着变量的名称
- 变量名必须以字母或者下划线字符开始
- 变量名只能包含字母数字字符和下划线（A-z、0-9 和 _ ）
- 变量名不能包含空格
- 变量名是区分大小写的（$y 和 $Y 是两个不同的变量）

### 创建变量 {#create-variables}

在没有声明类型的情况下，tphp 会根据变量值自动推导类型：

```php
class Main
{
    public function main(): void
    {
        // 声明变量，变量类型自动推导
        $name = "John";  // string
        $age = 30; // int
        $cars = ["Volvo", "BMW", "Toyota"]; // array<mixed>
        $x = 5; // int
        $y = 10.0; // float
        $z = $x + $y; // float
        $zz = new stdClass(); // object
        $fff = function(int $x):int { return $x * $x; }; // callable 回调函数必须强类型写法

        // 声明变量，指定类型
        int $a = 10;
        float $b = 10.0;
        string $c = "Hello";
        array<string> $d = ["a", "b", "c"];
        object $e = new stdClass();
        callable $f = function(int $x):int { return $x * $x; }; 
    }
}
```

### 变量作用域 {#variable-scope}

```php
function myTest() {
    // 局部变量
    $x = 10;
    echo $x;
}

class Main {
    public function main(): void {
        myTest();
        $a = 10;
        // 无 global 关键字，用 use 引用外部变量
        $fn = function(int $x) use($a):int{
            return $x + $a;
        }
    }
}
```

### tphp 数组 {#tphp-arrays}

tphp 数组是强类型泛型数组 `array<T>`，元素类型必须一致：

```php
class Main {
    public function main(): void {
        // 无声明类型数组，默认 array<mixed> 类型
        $arr = [1, "a", true]; 

        // 声明类型数组，内存减少~60%
        array<int> $arr2 = [1, 2, 3];
        array<string> $arr3 = ["a", "b", "c"];
        array<object> $arr4 = [new stdClass(), new stdClass()];
    }
}

```