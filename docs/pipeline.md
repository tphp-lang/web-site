## 编译流水线 {#pipeline}

从 PHP 源码到原生二进制的完整 AOT 流水线：

<div class="pipeline-flow">
    <span class="bny-tag" color="blue">PHP</span>
    <span class="arrow">→</span>
    <span class="bny-tag" color="blue">Lexer</span>
    <span class="arrow">→</span>
    <span class="bny-tag" color="blue">Token[]</span>
    <span class="arrow">→</span>
    <span class="bny-tag" color="blue">Parser</span>
    <span class="arrow">→</span>
    <span class="bny-tag" color="blue">AST</span>
    <span class="arrow">→</span>
    <span class="bny-tag" color="blue">CodeGenerator</span>
    <span class="arrow">→</span>
    <span class="bny-tag" color="blue">.c</span>
    <span class="arrow">→</span>
    <span class="bny-tag" color="blue">编译器</span>
    <span class="arrow">→</span>
    <span class="bny-tag" color="green">二进制</span>
</div>

### 阶段说明 {#stages}

1. **Lexer** — 逐字符扫描，约 75 种 Token，支持字符串插值 / heredoc
2. **Parser** — 递归下降，运算符优先级完整
3. **CodeGenerator** — 访问者模式，生成类型安全的 C 代码
4. **C 运行时** — COS 风格对象系统（16B 头），setjmp/longjmp 异常，ROPE 字符串拼接，128 槽数组/对象复用池，64KB 字符串池
5. **编译器** — 内置 TCC（mob 分支），支持 GCC / Clang
