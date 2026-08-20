@echo off
chcp 65001 >nul
echo ============================================
echo   心光 v2.2 防火墙安全配置
echo ============================================
echo.
echo 本脚本将执行以下操作：
echo   1. 删除旧的宽泛防火墙规则（若存在）
echo   2. 添加安全规则：仅允许"专用网络"访问 3001 端口
echo      （公司等"公用网络"环境自动免疫，无法访问）
echo.
echo 注意：必须以管理员身份运行本脚本！
echo.

REM 检查管理员权限
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 请右键本文件，选择"以管理员身份运行"后重试！
    echo.
    pause
    exit /b 1
)

echo [1/3] 清理旧的宽泛规则（旧版脚本遗留）...
netsh advfirewall firewall delete rule name="time-summary-app-3001" >nul 2>&1
netsh advfirewall firewall delete rule name="心光-3001-仅专用网络" >nul 2>&1
echo       已清理。

echo [2/3] 添加安全规则（仅专用网络，防火墙保持开启）...
netsh advfirewall firewall add rule name="心光-3001-仅专用网络" dir=in action=allow protocol=TCP localport=3001 profile=private
if %errorlevel% neq 0 (
    echo [错误] 规则添加失败，请检查系统策略！
    echo.
    pause
    exit /b 1
)

echo [3/3] 验证规则是否生效...
netsh advfirewall firewall show rule name="心光-3001-仅专用网络" | findstr /C:"已启用" /C:"Enabled" >nul
if %errorlevel% neq 0 (
    echo [警告] 无法自动确认规则状态，请手动执行：
    echo        netsh advfirewall firewall show rule name="心光-3001-仅专用网络"
) else (
    echo       规则已生效。
)

echo.
echo ============================================
echo   配置完成！
echo.
echo   - 防火墙全程保持开启，未做任何关闭操作
echo   - 家庭 WiFi（专用网络）下的设备可访问心光
echo   - 公司/公共 WiFi（公用网络）自动被拦截
echo   - 查看当前网络类别：设置 → 网络和 Internet
echo     → 点击当前 WiFi → 查看"网络配置文件类型"
echo ============================================
echo.
pause
