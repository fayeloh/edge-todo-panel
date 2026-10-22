#!/bin/bash
# 效能边缘面板 一键重启/停止/状态脚本
# 用法：
#   ~/Documents/AIIIII/edge-todo-panel/panel.sh restart   # 重启（最常用）
#   ~/Documents/AIIIII/edge-todo-panel/panel.sh stop      # 停止
#   ~/Documents/AIIIII/edge-todo-panel/panel.sh status    # 查看是否在运行
#   ~/Documents/AIIIII/edge-todo-panel/panel.sh log       # 看最近日志（排障用）

DIR="$HOME/Documents/AIIIII/edge-todo-panel"
LOG="/tmp/panel.log"

case "$1" in
  restart)
    pkill -f "AIIIII/edge-todo-panel" 2>/dev/null
    sleep 1
    cd "$DIR" && nohup npx electron . > "$LOG" 2>&1 &
    sleep 3
    if pgrep -f "AIIIII/edge-todo-panel" >/dev/null; then
      echo "✅ 面板已重启（左下角热区 / 托盘⚡ 双入口）"
    else
      echo "❌ 启动失败，看日志：$DIR/panel.sh log"
    fi
    ;;
  stop)
    pkill -f "AIIIII/edge-todo-panel" 2>/dev/null
    echo "已停止"
    ;;
  status)
    if pgrep -f "AIIIII/edge-todo-panel" >/dev/null; then
      echo "✅ 运行中 (PID: $(pgrep -f 'AIIIII/edge-todo-panel/node_modules/.bin/electron' | head -1))"
    else
      echo "❌ 未运行"
    fi
    ;;
  log)
    tail -20 "$LOG" 2>/dev/null || echo "暂无日志"
    ;;
  *)
    echo "用法: panel.sh {restart|stop|status|log}"
    ;;
esac
