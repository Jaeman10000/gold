"""측량소 — 점수 분해 + 테마 설정 API."""
from fastapi import APIRouter, Body, Query

from app.services import survey_service

router = APIRouter(prefix="/api/survey", tags=["survey"])


@router.get("")
def get_survey(market: str = Query("KR", pattern="^(KR|US)$")):
    """측량소 점수 분해.

    user_themes 있으면 theme 모드(미래정합성), 없으면 basic 모드(펀더멘털 스냅샷).
    """
    return survey_service.build_survey(market)


@router.post("/theme")
def set_theme(
    market: str = Query("KR", pattern="^(KR|US)$"),
    themes: list = Body(..., embed=True),
):
    """사용자 테마 설정 → 테마 모드 활성화.

    themes 항목은 프리셋 라벨(str) 또는 자급식 객체(dict) 혼합 가능.
      - 프리셋: "AI·반도체"  (themes.json 의 keywords/codes 로 보강 저장)
      - 커스텀: {"label": "내 미래 렌즈", "keywords": [...], "codes": [...]}
    themes=[] 이면 기본 모드 복귀 (delete 와 동일).
    """
    if themes:
        survey_service.set_user_themes(market, themes)
        saved = survey_service.get_user_themes(market)
        return {"status": "ok", "mode": "theme", "themes": saved}
    else:
        survey_service.delete_user_themes(market)
        return {"status": "ok", "mode": "basic", "themes": []}


@router.post("/theme/interpret")
def interpret_theme(text: str = Body(..., embed=True)):
    """자유입력 텍스트 해석 → 감지된 프리셋 테마 + 매칭 키워드 (확인용, 저장 안 함).

    예: {"text": "전기차·자율주행이 미래다"} → 자동차·모빌리티 감지.
    """
    return survey_service.interpret_text(text)


@router.delete("/theme")
def delete_theme(market: str = Query("KR", pattern="^(KR|US)$")):
    """테마 삭제 → 기본 모드(펀더멘털 스냅샷) 복귀."""
    survey_service.delete_user_themes(market)
    return {"status": "ok", "mode": "basic"}


@router.get("/themes/available")
def get_available_themes():
    """프론트에서 테마 선택 시트에 표시할 프리셋 목록."""
    from app.services import scoring_service
    themes = [
        {"id": t["id"], "label": t["label"], "note": t.get("note", "")}
        for t in scoring_service.load_themes()
    ]
    return {
        "status": "ok",
        "themes": themes,
        "note": "참고용 렌즈 템플릿입니다. 추천 성장 분야가 아닙니다.",
    }
