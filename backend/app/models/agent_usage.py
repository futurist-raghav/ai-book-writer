from sqlalchemy import String, Integer, DateTime, ForeignKey, Float, Boolean, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
import uuid

from app.db.base import Base

class AgentUsage(Base):
    __tablename__ = "agent_usage"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("user.id"), nullable=False, index=True)
    agent_type = Column(String, nullable=False)  # research, factcheck, tone, citation
    tokens_used: Mapped[int] = mapped_column(Integer, default=0)
    input_chars: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    
    def __repr__(self):
        return f"<AgentUsage {self.user_id} {self.agent_type} at {self.created_at}>"
