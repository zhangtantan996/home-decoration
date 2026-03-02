#!/bin/bash
# ============================================================
#  AI 编程工具管理脚本 (Codex / Claude / Gemini)
#  适用于 macOS
#  用法: bash scripts/update_ai_tools.sh
# ============================================================

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'
BOLD='\033[1m'
DIM='\033[2m'

# 图标
CHECK="✅"
CROSS="❌"
ARROW="➜"
SPARKLE="✨"
NEW="🆕"
PKG="📦"
ROCKET="🚀"

# ============================================================
# 工具函数
# ============================================================

print_header() {
    clear
    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}  ${BOLD}${SPARKLE} AI 编程工具管理器${NC}                          ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}  ${DIM}Codex · Claude · Gemini${NC}                       ${CYAN}║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_separator() {
    echo -e "${BLUE}────────────────────────────────────────────────────${NC}"
}

print_menu() {
    echo -e "  ${BOLD}请选择操作:${NC}"
    echo ""
    echo -e "  ${CYAN}1)${NC} ${PKG} 查看当前版本"
    echo -e "  ${CYAN}2)${NC} ${NEW} 检查可用更新"
    echo -e "  ${CYAN}3)${NC} ${ROCKET} 一键更新全部"
    echo -e "  ${CYAN}4)${NC} ${ARROW} 选择性更新"
    echo ""
    print_separator
    echo -e "  ${CYAN}0)${NC} 退出"
    echo ""
    echo -ne "  ${BOLD}请输入选项 [0-4]:${NC} "
}

# ============================================================
# 版本获取函数
# ============================================================

get_codex_local() {
    local ver
    ver=$(npm ls -g @openai/codex --depth=0 2>/dev/null | grep codex | sed 's/.*@//')
    echo "${ver:-未安装}"
}

get_codex_latest() {
    npm view @openai/codex version 2>/dev/null || echo "获取失败"
}

get_claude_local() {
    local ver
    ver=$(claude --version 2>/dev/null | head -1)
    if [ -z "$ver" ]; then
        echo "未安装"
    else
        echo "$ver"
    fi
}

get_claude_latest() {
    local ver
    ver=$(npm view @anthropic-ai/claude-code version 2>/dev/null)
    echo "${ver:-获取失败}"
}

get_gemini_local() {
    local ver
    ver=$(npm ls -g @google/gemini-cli --depth=0 2>/dev/null | grep gemini | sed 's/.*@//')
    echo "${ver:-未安装}"
}

get_gemini_latest() {
    npm view @google/gemini-cli version 2>/dev/null || echo "获取失败"
}

# ============================================================
# 功能 1: 查看当前版本
# ============================================================

show_current_versions() {
    print_header
    echo -e "  ${BOLD}${PKG} 当前已安装版本${NC}"
    echo ""
    print_separator

    echo -ne "  检测中..."
    local codex_v claude_v gemini_v
    codex_v=$(get_codex_local)
    claude_v=$(get_claude_local)
    gemini_v=$(get_gemini_local)
    echo -e "\r                    "

    printf "  ${CYAN}%-12s${NC} %-30s %s\n" "工具" "版本" "安装方式"
    print_separator
    if [ "$codex_v" = "未安装" ]; then
        printf "  %-12s ${RED}%-30s${NC} %s\n" "Codex" "$codex_v" "-"
    else
        printf "  %-12s ${GREEN}%-30s${NC} %s\n" "Codex" "$codex_v" "npm"
    fi
    if [ "$claude_v" = "未安装" ]; then
        printf "  %-12s ${RED}%-30s${NC} %s\n" "Claude" "$claude_v" "-"
    else
        printf "  %-12s ${GREEN}%-30s${NC} %s\n" "Claude" "$claude_v" "brew cask"
    fi
    if [ "$gemini_v" = "未安装" ]; then
        printf "  %-12s ${RED}%-30s${NC} %s\n" "Gemini" "$gemini_v" "-"
    else
        printf "  %-12s ${GREEN}%-30s${NC} %s\n" "Gemini" "$gemini_v" "npm"
    fi

    echo ""
    print_separator
    echo ""
    echo -ne "  按 Enter 返回主菜单..."
    read -r
}

# ============================================================
# 功能 2: 检查可用更新
# ============================================================

check_updates() {
    print_header
    echo -e "  ${BOLD}${NEW} 检查可用更新${NC}"
    echo ""
    print_separator

    echo -e "  ${DIM}正在查询最新版本，请稍候...${NC}"
    echo ""

    local codex_local codex_latest
    local claude_local claude_latest
    local gemini_local gemini_latest
    local has_update=false

    # 并行获取版本
    codex_local=$(get_codex_local)
    codex_latest=$(get_codex_latest)
    claude_local=$(get_claude_local)
    claude_latest=$(get_claude_latest)
    gemini_local=$(get_gemini_local)
    gemini_latest=$(get_gemini_latest)

    printf "  ${CYAN}%-12s${NC} %-20s %-20s %s\n" "工具" "当前版本" "最新版本" "状态"
    print_separator

    # Codex
    if [ "$codex_local" = "$codex_latest" ]; then
        printf "  %-12s %-20s %-20s ${GREEN}%s${NC}\n" "Codex" "$codex_local" "$codex_latest" "${CHECK} 已是最新"
    elif [ "$codex_local" = "未安装" ]; then
        printf "  %-12s ${RED}%-20s${NC} %-20s ${YELLOW}%s${NC}\n" "Codex" "$codex_local" "$codex_latest" "未安装"
    else
        printf "  %-12s ${YELLOW}%-20s${NC} ${GREEN}%-20s${NC} ${MAGENTA}%s${NC}\n" "Codex" "$codex_local" "$codex_latest" "${NEW} 可更新"
        has_update=true
    fi

    # Claude
    if [ "$claude_local" = "未安装" ]; then
        printf "  %-12s ${RED}%-20s${NC} %-20s ${YELLOW}%s${NC}\n" "Claude" "$claude_local" "$claude_latest" "未安装"
    elif echo "$claude_local" | grep -q "$claude_latest" 2>/dev/null; then
        printf "  %-12s %-20s %-20s ${GREEN}%s${NC}\n" "Claude" "$claude_local" "$claude_latest" "${CHECK} 已是最新"
    else
        printf "  %-12s ${YELLOW}%-20s${NC} ${GREEN}%-20s${NC} ${MAGENTA}%s${NC}\n" "Claude" "$claude_local" "$claude_latest" "${NEW} 可更新"
        has_update=true
    fi

    # Gemini
    if [ "$gemini_local" = "$gemini_latest" ]; then
        printf "  %-12s %-20s %-20s ${GREEN}%s${NC}\n" "Gemini" "$gemini_local" "$gemini_latest" "${CHECK} 已是最新"
    elif [ "$gemini_local" = "未安装" ]; then
        printf "  %-12s ${RED}%-20s${NC} %-20s ${YELLOW}%s${NC}\n" "Gemini" "$gemini_local" "$gemini_latest" "未安装"
    else
        printf "  %-12s ${YELLOW}%-20s${NC} ${GREEN}%-20s${NC} ${MAGENTA}%s${NC}\n" "Gemini" "$gemini_local" "$gemini_latest" "${NEW} 可更新"
        has_update=true
    fi

    echo ""
    print_separator

    if $has_update; then
        echo -e "  ${MAGENTA}💡 有可用更新，选择主菜单 3 或 4 进行更新${NC}"
    else
        echo -e "  ${GREEN}${CHECK} 所有工具均为最新版本${NC}"
    fi

    echo ""
    echo -ne "  按 Enter 返回主菜单..."
    read -r
}

# ============================================================
# 单个工具更新函数
# ============================================================

do_update_codex() {
    echo -e "  ${YELLOW}${ARROW} 更新 Codex...${NC}"
    local old_ver
    old_ver=$(get_codex_local)

    if [ "$old_ver" = "未安装" ]; then
        echo -e "  ${CROSS} Codex 未安装，跳过"
        return 1
    fi

    if npm install -g @openai/codex@latest 2>&1 | tail -3; then
        local new_ver
        new_ver=$(get_codex_local)
        if [ "$old_ver" = "$new_ver" ]; then
            echo -e "  ${CHECK} Codex 已是最新: ${GREEN}${new_ver}${NC}"
        else
            echo -e "  ${CHECK} Codex: ${RED}${old_ver}${NC} → ${GREEN}${new_ver}${NC}"
        fi
        return 0
    else
        echo -e "  ${CROSS} Codex 更新失败"
        return 1
    fi
}

do_update_claude() {
    echo -e "  ${YELLOW}${ARROW} 更新 Claude...${NC}"
    local old_ver
    old_ver=$(get_claude_local)

    if [ "$old_ver" = "未安装" ]; then
        echo -e "  ${CROSS} Claude 未安装，跳过"
        return 1
    fi

    echo -e "  ${DIM}通过 npm 更新...${NC}"
    if npm install -g @anthropic-ai/claude-code@latest 2>&1 | tail -3; then
        local new_ver
        new_ver=$(get_claude_local)
        if [ "$old_ver" = "$new_ver" ]; then
            echo -e "  ${CHECK} Claude 已是最新: ${GREEN}${new_ver}${NC}"
        else
            echo -e "  ${CHECK} Claude: ${RED}${old_ver}${NC} → ${GREEN}${new_ver}${NC}"
        fi
        return 0
    fi

    echo -e "  ${CROSS} Claude 更新失败"
    return 1
}

do_update_gemini() {
    echo -e "  ${YELLOW}${ARROW} 更新 Gemini...${NC}"
    local old_ver
    old_ver=$(get_gemini_local)

    if [ "$old_ver" = "未安装" ]; then
        echo -e "  ${CROSS} Gemini 未安装，跳过"
        return 1
    fi

    if npm install -g @google/gemini-cli@latest 2>&1 | tail -3; then
        local new_ver
        new_ver=$(get_gemini_local)
        if [ "$old_ver" = "$new_ver" ]; then
            echo -e "  ${CHECK} Gemini 已是最新: ${GREEN}${new_ver}${NC}"
        else
            echo -e "  ${CHECK} Gemini: ${RED}${old_ver}${NC} → ${GREEN}${new_ver}${NC}"
        fi
        return 0
    else
        echo -e "  ${CROSS} Gemini 更新失败"
        return 1
    fi
}

# ============================================================
# 功能 3: 一键更新全部
# ============================================================

update_all() {
    print_header
    echo -e "  ${BOLD}${ROCKET} 一键更新全部工具${NC}"
    echo ""
    print_separator
    echo ""

    local success=0
    local fail=0

    if do_update_codex; then  ((success+=1)); else ((fail+=1)); fi
    echo ""
    if do_update_claude; then ((success+=1)); else ((fail+=1)); fi
    echo ""
    if do_update_gemini; then ((success+=1)); else ((fail+=1)); fi

    echo ""
    print_separator
    echo ""
    echo -e "  ${BOLD}📋 更新结果: ${GREEN}${success} 成功${NC}, ${RED}${fail} 失败${NC}"
    echo ""
    echo -ne "  按 Enter 返回主菜单..."
    read -r
}

# ============================================================
# 功能 4: 选择性更新
# ============================================================

selective_update() {
    print_header
    echo -e "  ${BOLD}${ARROW} 选择要更新的工具${NC}"
    echo ""

    local codex_v claude_v gemini_v
    codex_v=$(get_codex_local)
    claude_v=$(get_claude_local)
    gemini_v=$(get_gemini_local)

    echo -e "  ${CYAN}1)${NC} Codex   ${DIM}(当前: ${codex_v})${NC}"
    echo -e "  ${CYAN}2)${NC} Claude  ${DIM}(当前: ${claude_v})${NC}"
    echo -e "  ${CYAN}3)${NC} Gemini  ${DIM}(当前: ${gemini_v})${NC}"
    echo ""
    echo -e "  ${DIM}输入编号，多个用空格分隔 (如: 1 3)${NC}"
    echo -e "  ${CYAN}0)${NC} 返回主菜单"
    echo ""
    echo -ne "  ${BOLD}请选择:${NC} "
    read -r choices

    if [ "$choices" = "0" ] || [ -z "$choices" ]; then
        return
    fi

    echo ""
    print_separator
    echo ""

    for choice in $choices; do
        case $choice in
            1) do_update_codex;  echo "" ;;
            2) do_update_claude; echo "" ;;
            3) do_update_gemini; echo "" ;;
            *) echo -e "  ${CROSS} 无效选项: $choice" ;;
        esac
    done

    print_separator
    echo ""
    echo -ne "  按 Enter 返回主菜单..."
    read -r
}

# ============================================================
# 主循环
# ============================================================

# 前置检查
if ! command -v npm &>/dev/null; then
    echo -e "${RED}${CROSS} npm 未安装，请先安装 Node.js${NC}"
    exit 1
fi

while true; do
    print_header
    print_menu
    read -r option

    case $option in
        1) show_current_versions ;;
        2) check_updates ;;
        3) update_all ;;
        4) selective_update ;;
        0)
            echo ""
            echo -e "  ${SPARKLE} 再见！"
            echo ""
            exit 0
            ;;
        *)
            echo -e "  ${CROSS} 无效选项，请重新选择"
            sleep 1
            ;;
    esac
done
