from datetime import datetime
from typing import Any, Dict, List, Literal, Optional, Union
from pydantic import BaseModel, ConfigDict


class RPSGenerateRequest(BaseModel):
    tahun_ajaran: str
    semester: Literal["Ganjil", "Genap"]
    topik: Optional[str] = None


class RPSResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    mata_kuliah_id: int
    tahun_ajaran: str
    semester: str
    status: str
    konten: Optional[Union[Dict[str, Any], List[Any], str]] = None
    sumber_dokumen_rag: Optional[Union[Dict[str, Any], List[Any]]] = None
    created_at: datetime