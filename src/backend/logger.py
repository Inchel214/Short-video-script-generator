"""
日志配置模块
提供统一的日志记录功能，支持文件和控制台输出
"""
import logging
import os
from datetime import datetime


def setup_logger(name='script_generator', log_dir='logs', level=logging.DEBUG):
    """
    配置日志记录器
    
    Args:
        name: 日志记录器名称
        log_dir: 日志文件目录
        level: 日志级别
    
    Returns:
        logging.Logger: 配置好的日志记录器
    """
    # 创建日志记录器
    logger = logging.getLogger(name)
    
    # 避免重复添加处理器
    if logger.handlers:
        return logger
    
    logger.setLevel(level)
    
    # 创建日志格式
    formatter = logging.Formatter(
        '%(asctime)s,%(msecs)d - %(name)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # 创建日志目录
    # 获取应用根目录（相对于 backend 模块）
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    log_path = os.path.join(backend_dir, log_dir)
    os.makedirs(log_path, exist_ok=True)
    
    # 按日期生成日志文件名
    log_filename = datetime.now().strftime('%Y-%m-%d') + '.log'
    log_file_path = os.path.join(log_path, log_filename)
    
    # 文件处理器 - 记录所有日志
    file_handler = logging.FileHandler(log_file_path, encoding='utf-8')
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(formatter)
    
    # 控制台处理器 - 只记录 INFO 及以上级别
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(formatter)
    
    # 添加处理器
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)
    
    logger.info(f"日志系统初始化完成，日志文件: {log_file_path}")
    
    return logger


def get_logger(name='script_generator'):
    """
    获取日志记录器（单例模式）
    
    Args:
        name: 日志记录器名称
    
    Returns:
        logging.Logger: 日志记录器
    """
    return setup_logger(name)


# 默认日志记录器
logger = setup_logger()
