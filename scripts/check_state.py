"""验证用户设置的加密状态：localStorage 密钥完整性 + SW 退役 + 恢复码重置入口"""
import time
from playwright.sync_api import sync_playwright

BASE = "http://192.168.3.3:3001/"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context()
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(f"[PAGEERROR] {e}"))
    page.on("console", lambda m: errors.append(f"[ERR] {m.text}") if m.type == "error" else None)
    try:
        page.goto(BASE, timeout=20000)
        page.wait_for_load_state("networkidle", timeout=20000)
        print("=== 1. 页面加载 ===")
        print("加载JS:", page.evaluate("() => performance.getEntriesByType('resource').map(e => e.name).filter(n => n.includes('assets')).join(', ')"))

        # SW 状态
        sw = page.evaluate("""() => ('serviceWorker' in navigator) ? navigator.serviceWorker.getRegistrations().then(rs => rs.map(r => ({scope: r.scope, active: r.active ? r.active.state : null, script: r.active ? r.active.scriptURL : null}))) : 'no-sw-support'""")
        print("=== 2. Service Worker ===")
        print(sw)

        # localStorage 密钥
        keys = page.evaluate("() => Object.keys(localStorage)")
        print("=== 3. localStorage 密钥 ===")
        for k in sorted(keys):
            if 'xu' in k.lower() or 'enc' in k.lower():
                v = page.evaluate(f"localStorage.getItem('{k}')")
                print(f"  {k}: {v[:90]}{'...' if v and len(v) > 90 else ''}")
        print("  (全部keys:", sorted(keys), ")")

        # 检查加密配置存在性
        print("=== 4. 加密相关配置检查 ===")
        checks = {
            "xinguang_encrypt_settings": "加密设置(enabled/pbkdf2)",
            "xinguang_login_salt": "登录盐值",
            "xinguang_login_hash": "登录哈希",
            "xinguang_mk_wrapped": "主密钥包装(密码加密)",
            "xinguang_mk_recovery_wrapped": "主密钥恢复包装",
            "xinguang_recovery_hash": "恢复码哈希",
        }
        for k, desc in checks.items():
            v = page.evaluate(f"localStorage.getItem('{k}')")
            print(f"  {'✅' if v else '❌'} {k} ({desc}): {'存在' if v else '缺失'}")

        errors_from_page = errors
        print("=== 5. 页面报错 ===")
        print(errors_from_page if errors_from_page else "无")

        print("=== 6. 登录并检查'忘记密码'入口 ===")
        pw = page.locator('input[type="password"]')
        if pw.count():
            print("（登录页，跳过 - 不干预用户环境）")
        else:
            print("（已登录状态）")

        # 页面 main 状态文本
        body = page.locator("body").inner_text()
        if "恢复码" in body:
            idx = body.find("恢复码")
            print("=== 7. 页面出现'恢复码'字样 ===")
            print(body[max(0,idx-100):idx+200].replace("\n", " | "))
    except Exception as e:
        print("ERROR:", type(e).__name__, str(e)[:600])
    finally:
        browser.close()