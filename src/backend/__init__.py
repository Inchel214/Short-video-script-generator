"""
后端模块初始化
"""
from .agent import generate_script, clear_history
from .api import app, run_server

__all__ = ['generate_script', 'clear_history', 'app', 'run_server']
