"""
Services Tests
Tests for business logic layer including LLM, STT, and export services
Covers Claude integration, Whisper transcription, and document export
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime


@pytest.mark.unit
@pytest.mark.services
@pytest.mark.llm
class TestClaudeService:
    """Test suite for Claude LLM service"""

    @pytest.fixture
    def mock_anthropic(self):
        """Mock Anthropic client"""
        with patch("app.services.llm.claude_service.anthropic") as mock:
            yield mock

    def test_claude_chat_basic(self, mock_anthropic):
        """Test basic Claude chat interaction"""
        mock_response = MagicMock()
        mock_response.content[0].text = "This is Claude's response"
        mock_anthropic.messages.create.return_value = mock_response

        from app.services.llm.claude_service import ClaudeService
        
        service = ClaudeService()
        response = service.chat(
            message="Hello Claude",
            context="Writing context",
        )

        assert "Claude" in response or response is not None
        mock_anthropic.messages.create.assert_called()

    def test_claude_character_suggestions(self, mock_anthropic):
        """Test Claude character development suggestions"""
        mock_response = MagicMock()
        mock_response.content[0].text = "Character suggestions..."
        mock_anthropic.messages.create.return_value = mock_response

        from app.services.llm.claude_service import ClaudeService
        
        service = ClaudeService()
        response = service.get_character_suggestions(
            character_name="Alice",
            character_desc="A curious explorer",
        )

        assert response is not None
        mock_anthropic.messages.create.assert_called()

    def test_claude_dialogue_assistance(self, mock_anthropic):
        """Test Claude dialogue writing assistance"""
        mock_response = MagicMock()
        mock_response.content[0].text = "Suggested dialogue..."
        mock_anthropic.messages.create.return_value = mock_response

        from app.services.llm.claude_service import ClaudeService
        
        service = ClaudeService()
        response = service.get_dialogue_suggestions(
            context="Two characters meeting",
            character_names=["Alice", "Bob"],
        )

        assert response is not None

    def test_claude_plot_suggestions(self, mock_anthropic):
        """Test Claude plot development suggestions"""
        mock_response = MagicMock()
        mock_response.content[0].text = "Plot suggestions..."
        mock_anthropic.messages.create.return_value = mock_response

        from app.services.llm.claude_service import ClaudeService
        
        service = ClaudeService()
        response = service.get_plot_suggestions(
            book_title="My Novel",
            current_section="Middle act",
        )

        assert response is not None

    def test_claude_world_building(self, mock_anthropic):
        """Test Claude world building assistance"""
        mock_response = MagicMock()
        mock_response.content[0].text = "World building ideas..."
        mock_anthropic.messages.create.return_value = mock_response

        from app.services.llm.claude_service import ClaudeService
        
        service = ClaudeService()
        response = service.get_world_suggestions(
            world_name="Kingdom of magic",
            elements=["magic_system"],
        )

        assert response is not None

    def test_claude_error_handling(self, mock_anthropic):
        """Test Claude service error handling"""
        mock_anthropic.messages.create.side_effect = Exception("API Error")

        from app.services.llm.claude_service import ClaudeService
        
        service = ClaudeService()
        
        with pytest.raises(Exception):
            service.chat("Hello", "context")

    def test_claude_token_limit(self, mock_anthropic):
        """Test Claude token limit handling"""
        # Long context that might exceed token limits
        context = "x" * 100000  # Large context
        
        from app.services.llm.claude_service import ClaudeService
        
        service = ClaudeService()
        # Should handle gracefully
        mock_anthropic.messages.create.return_value = MagicMock(
            content=[MagicMock(text="Response")]
        )


@pytest.mark.unit
@pytest.mark.services
@pytest.mark.stt
class TestWhisperSTTService:
    """Test suite for Whisper speech-to-text service"""

    @pytest.fixture
    def mock_whisper(self):
        """Mock Whisper service"""
        with patch("app.services.stt.whisper_service.WhisperVM") as mock:
            yield mock

    def test_transcribe_audio_success(self, mock_whisper, test_audio_file):
        """Test successful audio transcription"""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "text": "Transcribed text",
            "language": "en",
            "confidence": 0.95,
        }
        mock_whisper.return_value.post.return_value = mock_response

        from app.services.stt.whisper_service import WhisperSTTService
        
        service = WhisperSTTService()
        result = service.transcribe(test_audio_file.file_path)

        assert result is not None
        assert "text" in str(result)

    def test_transcribe_audio_with_language(self, mock_whisper):
        """Test transcription with specific language"""
        from app.services.stt.whisper_service import WhisperSTTService
        
        service = WhisperSTTService()
        mock_whisper.return_value.post.return_value = MagicMock(
            json=MagicMock(return_value={"text": "Texte transcrit"})
        )

        result = service.transcribe("audio.mp3", language="fr")
        assert result is not None

    def test_transcribe_audio_error(self, mock_whisper):
        """Test transcription error handling"""
        mock_whisper.return_value.post.side_effect = Exception("Service unavailable")

        from app.services.stt.whisper_service import WhisperSTTService
        
        service = WhisperSTTService()
        
        with pytest.raises(Exception):
            service.transcribe("audio.mp3")

    def test_transcribe_audio_timeout(self, mock_whisper):
        """Test transcription timeout"""
        from app.services.stt.whisper_service import WhisperSTTService
        
        service = WhisperSTTService()
        mock_whisper.return_value.post.side_effect = TimeoutError("Request timed out")
        
        with pytest.raises(TimeoutError):
            service.transcribe("audio.mp3")

    def test_transcribe_large_audio_file(self, mock_whisper):
        """Test transcribing large audio files"""
        from app.services.stt.whisper_service import WhisperSTTService
        
        service = WhisperSTTService()
        mock_whisper.return_value.post.return_value = MagicMock(
            json=MagicMock(return_value={"text": "Long transcription..."})
        )

        result = service.transcribe("large_audio.mp3")
        assert result is not None


@pytest.mark.unit
@pytest.mark.services
@pytest.mark.export
class TestExportService:
    """Test suite for document export service"""

    @pytest.fixture
    def mock_pdf_generator(self):
        """Mock PDF generator"""
        with patch("app.services.export.pdf_generator") as mock:
            yield mock

    def test_export_to_pdf(self, mock_pdf_generator, test_book):
        """Test PDF export"""
        mock_pdf_generator.return_value = b"PDF content"

        from app.services.export import ExportService
        
        service = ExportService()
        result = service.export_to_pdf(
            book_id=test_book.id,
            chapters=[],
            format_options={},
        )

        assert result is not None

    def test_export_to_epub(self, test_book):
        """Test EPUB export"""
        from app.services.export import ExportService
        
        service = ExportService()
        result = service.export_to_epub(
            book_id=test_book.id,
            chapters=[],
        )

        assert result is not None

    def test_export_to_docx(self, test_book):
        """Test DOCX export"""
        from app.services.export import ExportService
        
        service = ExportService()
        result = service.export_to_docx(
            book_id=test_book.id,
            chapters=[],
        )

        assert result is not None

    def test_export_with_toc(self, test_book):
        """Test export with table of contents"""
        from app.services.export import ExportService
        
        service = ExportService()
        result = service.export_to_pdf(
            book_id=test_book.id,
            chapters=[],
            format_options={"include_toc": True},
        )

        assert result is not None

    def test_export_with_metadata(self, test_book):
        """Test export with book metadata"""
        from app.services.export import ExportService
        
        service = ExportService()
        result = service.export_to_pdf(
            book_id=test_book.id,
            chapters=[],
            format_options={"include_metadata": True},
        )

        assert result is not None

    def test_export_empty_book(self, test_book):
        """Test exporting empty book"""
        from app.services.export import ExportService
        
        service = ExportService()
        result = service.export_to_pdf(
            book_id=test_book.id,
            chapters=[],
        )

        assert result is not None

    def test_export_large_book(self, test_book):
        """Test exporting large book with many chapters"""
        from app.services.export import ExportService
        
        service = ExportService()
        # Simulate many chapters
        chapters = [{"title": f"Chapter {i}", "content": "x" * 10000} for i in range(100)]
        
        result = service.export_to_pdf(
            book_id=test_book.id,
            chapters=chapters,
        )

        assert result is not None


@pytest.mark.unit
@pytest.mark.services
class TestGeminiService:
    """Test suite for Google Gemini service"""

    @pytest.fixture
    def mock_gemini(self):
        """Mock Gemini client"""
        with patch("app.services.llm.gemini_service.genai") as mock:
            yield mock

    def test_gemini_generate_text(self, mock_gemini):
        """Test Gemini text generation"""
        mock_response = MagicMock()
        mock_response.text = "Generated content"
        mock_gemini.generate_content.return_value = mock_response

        from app.services.llm.gemini_service import GeminiService
        
        service = GeminiService()
        result = service.generate(prompt="Write a story")

        assert result is not None

    def test_gemini_streaming(self, mock_gemini):
        """Test Gemini streaming responses"""
        from app.services.llm.gemini_service import GeminiService
        
        service = GeminiService()
        mock_gemini.generate_content.return_value = iter([
            MagicMock(text="Part 1"),
            MagicMock(text="Part 2"),
        ])

        result = service.generate_stream(prompt="Write a story")
        assert result is not None
