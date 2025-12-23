# signIn 和 signOut 详解

## 📋 概述

`signIn` 和 `signOut` 是 **NextAuth** 提供的两个核心函数，用于处理用户登录和登出。

---

## 🔍 signIn 和 signOut 来自哪里？

### 代码位置：`auth.ts`

```32:32:auth.ts
export const { auth, signIn, signOut } = NextAuth({
```

**解释：**
- `NextAuth()` 函数返回一个对象
- 使用**解构赋值**提取 `auth`、`signIn`、`signOut` 三个函数
- 这些函数是 NextAuth 自动生成的

**类比理解：**
```typescript
// 就像这样：
const result = NextAuth({ ... });
const signIn = result.signIn;
const signOut = result.signOut;
const auth = result.auth;
```

---

## 🔐 signIn - 登录函数

### 1. 函数签名

```typescript
signIn(provider: string, credentials?: FormData | object, options?: object)
```

### 2. 在你的代码中的使用

**位置：`app/lib/actions.ts`**

```127:142:app/lib/actions.ts
export async function authenticate(
    prevState: string | undefined,
    formData: FormData,
  ) {
    try {
      await signIn('credentials', formData);
    } catch (error) {
      if (error instanceof AuthError) {
        switch (error.type) {
          case 'CredentialsSignin':
            return 'Invalid credentials.';
        }
      }
      throw error;
    }
  }
```

**参数解释：**
- `'credentials'`：认证提供者名称（对应 `auth.ts` 中的 `Credentials` provider）
- `formData`：表单数据（包含 `email` 和 `password`）

---

### 3. signIn 做了什么？

#### 完整流程：

```
1. 接收用户凭据（email + password）
    ↓
2. 调用 auth.ts 中的 Credentials provider
    ↓
3. 执行 authorize 函数
   ├─ 验证输入格式（Zod）
   ├─ 查询数据库（getUser）
   └─ 验证密码（bcrypt.compare）
    ↓
4. authorize 返回用户对象？
    ├─ 是 ✅
    │   ├─ NextAuth 创建会话（Session）
    │   ├─ 生成加密的 Cookie
    │   ├─ 将 Cookie 发送给浏览器
    │   └─ 自动重定向到 callbackUrl
    │
    └─ 否 ❌
        └─ 抛出 AuthError（CredentialsSignin）
```

---

### 4. signIn 的内部工作

**步骤 1：调用 Provider**

```typescript
signIn('credentials', formData)
    ↓
NextAuth 查找名为 'credentials' 的 provider
    ↓
找到 Credentials provider（在 auth.ts 中定义）
```

**步骤 2：执行 authorize 函数**

```35:51:auth.ts
    Credentials({
      async authorize(credentials) {
        const parsedCredentials = z
          .object({ email: z.string().email(), password: z.string().min(6) })
          .safeParse(credentials);

        if (parsedCredentials.success) {
          const { email, password } = parsedCredentials.data;
          const user = await getUser(email);
          if (!user) return null;
          const passwordsMatch = await bcrypt.compare(password, user.password);
          if (passwordsMatch) return user;
        }
        
        console.log('Invalid credentials');
        return null;
      },
    }),
```

**步骤 3：创建会话**

如果 `authorize` 返回用户对象：
- NextAuth 创建一个**会话（Session）**
- 会话包含用户信息（ID、邮箱等）
- 会话被加密并存储在 **Cookie** 中
- Cookie 名称通常是：`authjs.session-token`

**步骤 4：重定向**

- 如果成功：自动重定向到 `callbackUrl`（从 formData 中获取）
- 如果失败：抛出错误，不会重定向

---

### 5. signIn 的返回值

```typescript
await signIn('credentials', formData);
```

**成功时：**
- 不会返回值（返回 `void`）
- 会自动重定向，所以不会执行后续代码

**失败时：**
- 抛出 `AuthError` 异常
- 需要 `try-catch` 捕获

---

## 🚪 signOut - 登出函数

### 1. 函数签名

```typescript
signOut(options?: { redirectTo?: string, redirect?: boolean })
```

### 2. 在你的代码中的使用

**位置：`app/ui/dashboard/sidenav.tsx`**

```21:24:app/ui/dashboard/sidenav.tsx
        <form action={async () => {
          'use server';
          await signOut();
        }}>
```

**参数：**
- 无参数：使用默认行为（清除会话，重定向到登录页）

---

### 3. signOut 做了什么？

#### 完整流程：

```
1. 调用 signOut()
    ↓
2. NextAuth 清除会话 Cookie
    ↓
3. 删除浏览器中的 authjs.session-token Cookie
    ↓
4. 自动重定向到登录页（/login）
    ↓
5. 用户已登出 ✅
```

---

### 4. signOut 的内部工作

**步骤 1：清除会话**

```typescript
signOut()
    ↓
NextAuth 查找当前会话
    ↓
删除服务器端的会话数据（如果使用数据库存储）
    ↓
清除浏览器 Cookie
```

**步骤 2：重定向**

- 默认重定向到 `/login`（在 `auth.config.ts` 中配置）
- 可以自定义重定向地址：

```typescript
await signOut({ redirectTo: '/home' });
```

---

## 🔄 完整对比

### signIn（登录）

| 方面 | 说明 |
|------|------|
| **作用** | 验证用户凭据并创建会话 |
| **输入** | 用户邮箱和密码 |
| **过程** | 1. 验证凭据<br>2. 创建会话<br>3. 设置 Cookie |
| **成功结果** | 用户已登录，可以访问受保护页面 |
| **失败结果** | 抛出错误，用户未登录 |
| **自动行为** | 成功后自动重定向 |

### signOut（登出）

| 方面 | 说明 |
|------|------|
| **作用** | 清除用户会话 |
| **输入** | 无（或可选的重定向地址） |
| **过程** | 1. 清除会话<br>2. 删除 Cookie |
| **结果** | 用户已登出，无法访问受保护页面 |
| **自动行为** | 自动重定向到登录页 |

---

## 🍪 Session（会话）详解

### 什么是 Session？

**Session（会话）** 是用户登录状态的表示：

```typescript
Session {
  user: {
    id: "410544b2-4001-4271-9855-fec4b6a6442a",
    email: "user@nextmail.com",
    name: "User"
  },
  expires: "2024-01-15T10:30:00.000Z"
}
```

### Session 如何存储？

**方式 1：Cookie（默认）**
- 存储在浏览器的 Cookie 中
- 名称：`authjs.session-token`
- 加密存储，用户无法直接读取

**方式 2：数据库（可选）**
- 可以配置存储在数据库中
- 更安全，支持跨设备登出

### Session 的生命周期

```
用户登录
    ↓
signIn() 创建 Session
    ↓
Session 存储在 Cookie 中
    ↓
每次请求自动验证 Session
    ↓
用户登出
    ↓
signOut() 清除 Session
```

---

## 📊 数据流图

### signIn 流程

```
用户提交表单
    ↓
authenticate(formData)
    ↓
signIn('credentials', formData)
    ↓
NextAuth 调用 Credentials provider
    ↓
执行 authorize(credentials)
    ↓
    ├─ 查询数据库
    ├─ 验证密码
    └─ 返回用户对象
    ↓
NextAuth 创建 Session
    ↓
生成加密 Cookie
    ↓
设置 Cookie 到浏览器
    ↓
重定向到 /dashboard
    ↓
用户已登录 ✅
```

### signOut 流程

```
用户点击"Sign Out"
    ↓
调用 signOut()
    ↓
NextAuth 清除 Session
    ↓
删除 Cookie
    ↓
重定向到 /login
    ↓
用户已登出 ✅
```

---

## 🎯 实际使用示例

### 示例 1：登录（成功）

```typescript
// app/lib/actions.ts
export async function authenticate(formData: FormData) {
  try {
    await signIn('credentials', formData);
    // 如果成功，不会执行到这里（已重定向）
  } catch (error) {
    // 如果失败，捕获错误
    return 'Invalid credentials.';
  }
}
```

**执行过程：**
1. 用户输入：`email: "user@example.com"`, `password: "123456"`
2. `signIn` 验证凭据
3. 验证成功，创建会话
4. 自动重定向到 `/dashboard`
5. 用户看到 dashboard 页面

---

### 示例 2：登录（失败）

```typescript
export async function authenticate(formData: FormData) {
  try {
    await signIn('credentials', formData);
  } catch (error) {
    // 错误类型：CredentialsSignin
    return 'Invalid credentials.';
  }
}
```

**执行过程：**
1. 用户输入错误的密码
2. `signIn` 验证凭据
3. `authorize` 返回 `null`（密码不匹配）
4. `signIn` 抛出 `AuthError`
5. `catch` 捕获错误
6. 返回错误信息
7. 表单显示错误信息

---

### 示例 3：登出

```typescript
// app/ui/dashboard/sidenav.tsx
<form action={async () => {
  'use server';
  await signOut();
}}>
  <button>Sign Out</button>
</form>
```

**执行过程：**
1. 用户点击"Sign Out"按钮
2. 表单提交
3. 调用 `signOut()`
4. NextAuth 清除会话 Cookie
5. 自动重定向到 `/login`
6. 用户看到登录页面

---

## 🔑 关键要点

### 1. signIn 和 signOut 是异步函数

```typescript
await signIn(...);  // 必须使用 await
await signOut();    // 必须使用 await
```

### 2. signIn 成功后会自动重定向

```typescript
await signIn('credentials', formData);
console.log('这行代码不会执行！');  // 因为已经重定向了
```

### 3. signIn 失败会抛出异常

```typescript
try {
  await signIn('credentials', formData);
} catch (error) {
  // 必须捕获错误
  if (error instanceof AuthError) {
    // 处理认证错误
  }
}
```

### 4. signOut 也会自动重定向

```typescript
await signOut();
console.log('这行代码不会执行！');  // 因为已经重定向了
```

---

## ✅ 总结

### signIn（登录）

- **作用**：验证用户凭据，创建会话
- **输入**：认证提供者名称 + 用户凭据
- **成功**：创建会话 Cookie，自动重定向
- **失败**：抛出异常，需要捕获处理

### signOut（登出）

- **作用**：清除用户会话
- **输入**：无（或可选配置）
- **结果**：删除 Cookie，自动重定向到登录页

### 核心概念

- **Session（会话）**：用户登录状态的表示
- **Cookie**：存储会话的加密数据
- **自动重定向**：成功/失败后自动跳转页面

这两个函数是 NextAuth 的核心，负责整个身份验证流程的登录和登出部分！

