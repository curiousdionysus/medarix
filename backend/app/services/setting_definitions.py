from dataclasses import dataclass


@dataclass(frozen=True)
class SettingDefinition:
    key: str
    value: str
    category: str
    label: str
    description: str
    is_secret: bool = False
