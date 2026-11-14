from app.core.config import AppEnv, ProviderMode, Settings


def test_blank_secret_means_not_configured():
    s = Settings(_env_file=None, anthropic_api_key="   ", youtube_api_key="")
    assert s.anthropic_api_key is None
    assert s.youtube_api_key is None


def test_secrets_never_appear_in_repr():
    s = Settings(_env_file=None, anthropic_api_key="sk-ant-very-secret")
    assert "sk-ant-very-secret" not in repr(s)
    assert "sk-ant-very-secret" not in str(s.model_dump())


def test_default_mode_is_sample():
    assert Settings(_env_file=None).provider_mode == ProviderMode.SAMPLE


def test_cors_origins_parsed_from_comma_string():
    s = Settings(_env_file=None, cors_origins="https://a.ng, https://b.ng")
    assert s.cors_origins == ["https://a.ng", "https://b.ng"]


def test_production_rejects_unsafe_defaults():
    s = Settings(
        _env_file=None,
        app_env=AppEnv.PRODUCTION,
        admin_api_token="short",
        database_url="postgresql+psycopg://omoluabi:omoluabi@localhost/omoluabi",
        cors_origins="http://localhost:3000",
    )
    problems = s.validate_for_production()
    assert any("ADMIN_API_TOKEN" in p for p in problems)
    assert any("DATABASE_URL" in p for p in problems)
    assert any("CORS" in p for p in problems)


def test_production_accepts_safe_config():
    s = Settings(
        _env_file=None,
        app_env=AppEnv.PRODUCTION,
        admin_api_token="x" * 40,
        database_url="postgresql+psycopg://app:strong@db:5432/omoluabi",
        cors_origins="https://admin.omoluabi.ng",
    )
    assert s.validate_for_production() == []


def test_production_allows_no_service_token():
    s = Settings(
        _env_file=None,
        app_env=AppEnv.PRODUCTION,
        admin_api_token=None,
        database_url="postgresql+psycopg://app:strong@db:5432/omoluabi",
        cors_origins="https://admin.omoluabi.ng",
    )
    assert s.validate_for_production() == []
