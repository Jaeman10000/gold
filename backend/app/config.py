"""앱 설정 — .env 에서 로드. 키움 키·시크릿은 서버에만 보관 (CLAUDE.md 하드룰 §4)."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # 키움 (Phase 2). v1 mock 에선 비어있어도 됨.
    kiwoom_app_key: str = ""
    kiwoom_app_secret: str = ""
    kiwoom_use_mock: bool = False  # True = mockapi.kiwoom.com (모의투자)

    # DART (Phase 3 재무 데이터). opendart.fss.or.kr 에서 무료 발급.
    dart_api_key: str = ""

    # DB
    database_url: str = "sqlite:///./data.db"

    # 데이터 소스: "mock" | "kiwoom"
    data_provider: str = "mock"

    # CORS (콤마 구분). trycloudflare.com은 regex로 별도 허용.
    cors_origins: str = "http://localhost:5173"

    # 패스코드 접근 제한 (v1.5 싱글유저). 비어있으면 제한 없음(로컬 개발용).
    app_passcode: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
