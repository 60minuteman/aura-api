#!/bin/bash

# 🐳 Docker PostgreSQL Management for Aura API
# This script helps you manage the PostgreSQL Docker container for development

echo "🐳 Aura API - PostgreSQL Docker Management"
echo "=========================================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed!"
    echo "📥 Install Docker Desktop from: https://www.docker.com/products/docker-desktop/"
    exit 1
fi

case "$1" in
    "start")
        echo "🚀 Starting PostgreSQL container..."
        docker run --name aura-postgres \
          -e POSTGRES_PASSWORD=password \
          -e POSTGRES_DB=aura_api_db \
          -p 5432:5432 \
          -d postgres:15
        echo "✅ PostgreSQL container started!"
        echo "📊 Connection: postgresql://postgres:password@localhost:5432/aura_api_db"
        ;;
        
    "stop")
        echo "⏹️  Stopping PostgreSQL container..."
        docker stop aura-postgres
        echo "✅ PostgreSQL container stopped!"
        ;;
        
    "restart")
        echo "🔄 Restarting PostgreSQL container..."
        docker restart aura-postgres
        echo "✅ PostgreSQL container restarted!"
        ;;
        
    "resume")
        echo "▶️  Resuming existing PostgreSQL container..."
        docker start aura-postgres
        echo "✅ PostgreSQL container resumed!"
        ;;
        
    "reset")
        echo "🗑️  Resetting PostgreSQL container..."
        docker stop aura-postgres 2>/dev/null || true
        docker rm aura-postgres 2>/dev/null || true
        echo "🚀 Creating fresh PostgreSQL container..."
        docker run --name aura-postgres \
          -e POSTGRES_PASSWORD=password \
          -e POSTGRES_DB=aura_api_db \
          -p 5432:5432 \
          -d postgres:15
        echo "✅ PostgreSQL container reset and started!"
        ;;
        
    "status")
        echo "📊 PostgreSQL container status:"
        docker ps -a --filter name=aura-postgres
        ;;
        
    "logs")
        echo "📋 PostgreSQL container logs:"
        docker logs aura-postgres
        ;;
        
    "shell")
        echo "🐚 Connecting to PostgreSQL shell..."
        docker exec -it aura-postgres psql -U postgres -d aura_api_db
        ;;
        
    *)
        echo "Usage: $0 {start|stop|restart|resume|reset|status|logs|shell}"
        echo ""
        echo "Commands:"
        echo "  start   - Create and start a new PostgreSQL container"
        echo "  stop    - Stop the PostgreSQL container"
        echo "  restart - Restart the existing container"
        echo "  resume  - Start the existing stopped container"
        echo "  reset   - Delete and recreate the container (⚠️  data loss!)"
        echo "  status  - Show container status"
        echo "  logs    - Show container logs"
        echo "  shell   - Connect to PostgreSQL shell"
        echo ""
        echo "💡 Quick start:"
        echo "  1. ./docker-postgres.sh start"
        echo "  2. npx prisma db push"
        echo "  3. yarn start:dev"
        ;;
esac 