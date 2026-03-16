class GlobalMediaSearch {
    constructor() {
        this.currentQuery = '';
        this.currentLanguage = 'auto';
        this.currentPage = 1;
        this.totalResults = 0;
        this.resultsPerPage = 20;
        this.searchResults = [];
        this.detectedLanguage = null;
        this.alternativeLanguages = [];
        
        this.initializeEventListeners();
        this.loadSettings();
    }

    // REAL INTERNET VIDEO SEARCH
    async searchInternetVideos(query, language) {
        // Search Internet Archive - FREE, no API key needed!
        const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(query)}&fl=identifier,title,description,language,mediatype,publicdate,creator&output=json&rows=20`;
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            
            return data.response.docs
                .filter(item => 
                    (language === 'auto' || !item.language || item.language.includes(language)) &&
                    (item.mediatype === 'movies' || item.mediatype === 'audio')
                )
                .map(item => ({
                    id: item.identifier,
                    title: item.title || 'Untitled',
                    description: item.description || 'No description available',
                    transcript: item.description ? `Content: ${item.description.substring(0, 200)}...` : 'No transcript available',
                    mediaType: item.mediatype === 'movies' ? 'video' : 'audio',
                    language: item.language ? item.language[0] : 'unknown',
                    url: `https://archive.org/details/${item.identifier}`,
                    publishedAt: item.publicdate,
                    creator: item.creator || 'Unknown',
                    thumbnail: `https://archive.org/services/img/${item.identifier}`,
                    region: this.getRegionFromLanguage(item.language ? item.language[0] : 'en')
                }));
        } catch (error) {
            console.error('Search error:', error);
            return [];
        }
    }

    async detectLanguage(text) {
        const patterns = {
            en: /\b(the|and|or|but|in|on|at|to|for|of|with|by|that|this|these|those|a|an)\b/i,
            es: /\b(el|la|los|las|un|una|y|o|pero|en|de|con|por|para|desde|hasta)\b/i,
            fr: /\b(le|la|les|un|une|et|ou|mais|dans|sur|sous|avec|pour|par|de|à)\b/i,
            de: /\b(der|die|das|ein|eine|und|oder|aber|in|auf|unter|mit|für|von|zu)\b/i,
            it: /\b(il|lo|la|i|gli|le|un|uno|una|e|o|ma|in|su|sotto|con|per|da)\b/i,
            pt: /\b(o|a|os|as|um|uma|e|ou|mas|em|sob|com|para|por|de|desde)\b/i,
            ru: /[а-яё]/i,
            zh: /[\u4e00-\u9fff]/,
            ja: /[\u3040-\u309f\u30a0-\u30ff]/,
            ar: /[\u0600-\u06ff]/,
            hi: /[\u0900-\u097f]/
        };

        for (const [lang, pattern] of Object.entries(patterns)) {
            if (pattern.test(text)) {
                return lang;
            }
        }
        return 'en';
    }

    async executeSearch() {
        const mediaType = document.getElementById('mediaType').value;
        const searchLanguage = document.getElementById('searchLanguage').value;
        const contentRegion = document.getElementById('contentRegion').value;
        const includeDialects = document.getElementById('includeDialects').checked;

        // Search real internet videos!
        const results = await this.searchInternetVideos(this.currentQuery, this.detectedLanguage);
        
        // Filter by media type if needed
        let filteredResults = results;
        if (mediaType !== 'all') {
            filteredResults = results.filter(result => result.mediaType === mediaType);
        }

        // Filter by region if needed
        if (contentRegion !== 'global') {
            filteredResults = results.filter(result => result.region === contentRegion);
        }

        this.searchResults = filteredResults;
        this.totalResults = filteredResults.length;
        
        this.hideLoadingState();
        this.displayResults();
        this.suggestAlternativeLanguages();
    }

    initializeEventListeners() {
        document.getElementById('searchBtn').addEventListener('click', () => this.performSearch());
        document.getElementById('searchInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.performSearch();
        });
        document.getElementById('advancedToggle').addEventListener('click', () => {
            document.getElementById('advancedPanel').classList.toggle('hidden');
        });
        document.getElementById('sortBy').addEventListener('change', () => this.sortResults());
        document.getElementById('loadMoreBtn').addEventListener('click', () => this.loadMoreResults());
    }

    async performSearch() {
        const query = document.getElementById('searchInput').value.trim();
        if (!query) return;

        this.currentQuery = query;
        this.currentPage = 1;
        this.showLoadingState();

        const searchLanguage = document.getElementById('searchLanguage').value;
        if (searchLanguage === 'auto') {
            this.detectedLanguage = await this.detectLanguage(query);
        } else {
            this.detectedLanguage = searchLanguage;
        }

        await this.executeSearch();
    }

    createResultElement(result) {
        const div = document.createElement('div');
        div.className = 'search-card bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow';
        
        const languageName = this.getLanguageName(result.language);
        const mediaTypeIcon = this.getMediaTypeIcon(result.mediaType);

        div.innerHTML = `
            <div class="flex items-start space-x-4">
                <img src="${result.thumbnail}" alt="Video thumbnail" class="w-24 h-18 object-cover rounded" onerror="this.src='https://via.placeholder.com/96x72?text=Video'">
                <div class="flex-1">
                    <div class="flex items-center space-x-3 mb-2">
                        <span class="media-tag ${result.mediaType}-tag">
                            <i class="${mediaTypeIcon} mr-1"></i>
                            ${result.mediaType === 'video' ? 'Video' : 'Audio'}
                        </span>
                        <span class="media-tag language-badge">
                            <i class="fas fa-language mr-1"></i>
                            ${languageName}
                        </span>
                        <span class="text-xs text-gray-500">
                            <i class="fas fa-map-marker-alt mr-1"></i>
                            ${this.getRegionName(result.region)}
                        </span>
                    </div>
                    
                    <h3 class="text-lg font-semibold text-gray-900 mb-2">
                        <a href="${result.url}" target="_blank" class="hover:text-blue-600">
                            ${result.title}
                        </a>
                    </h3>
                    
                    <div class="transcript-preview text-gray-600 text-sm mb-3">
                        ${result.description}
                    </div>
                    
                    <div class="flex items-center justify-between text-xs text-gray-500">
                        <div class="flex items-center space-x-4">
                            <span>
                                <i class="fas fa-user mr-1"></i>
                                ${result.creator}
                            </span>
                            <span>
                                <i class="fas fa-calendar mr-1"></i>
                                ${new Date(result.publishedAt).toLocaleDateString()}
                            </span>
                        </div>
                        <div class="flex items-center space-x-2">
                            <a href="${result.url}" target="_blank" class="text-blue-600 hover:text-blue-800">
                                <i class="fas fa-external-link-alt mr-1"></i>
                                Watch Now
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        `;
        return div;
    }

    getRegionFromLanguage(language) {
        const languageRegions = {
            'en': 'us', 'es': 'latin-america', 'fr': 'eu', 'de': 'eu', 'it': 'eu', 
            'pt': 'latin-america', 'ru': 'eu', 'zh': 'asia', 'ja': 'asia', 'ar': 'middle-east', 'hi': 'asia'
        };
        return languageRegions[language] || 'global';
    }

    getLanguageName(code) {
        const languages = {
            en: 'English', es: 'Spanish', fr: 'French', de: 'German', it: 'Italian',
            pt: 'Portuguese', ru: 'Russian', zh: 'Chinese', ja: 'Japanese', ar: 'Arabic', hi: 'Hindi'
        };
        return languages[code] || code.toUpperCase();
    }

    getRegionName(code) {
        const regions = {
            'us': 'United States', 'uk': 'United Kingdom', 'eu': 'Europe', 'asia': 'Asia Pacific',
            'africa': 'Africa', 'latin-america': 'Latin America', 'middle-east': 'Middle East', 'global': 'Global'
        };
        return regions[code] || code.toUpperCase();
    }

    getMediaTypeIcon(mediaType) {
        const icons = { video: 'fas fa-video', audio: 'fas fa-microphone', text: 'fas fa-file-alt' };
        return icons[mediaType] || 'fas fa-file';
    }

    showLoadingState() {
        document.getElementById('loadingState').classList.remove('hidden');
        document.getElementById('resultsSection').classList.add('hidden');
    }

    hideLoadingState() {
        document.getElementById('loadingState').classList.add('hidden');
        document.getElementById('resultsSection').classList.remove('hidden');
    }

    displayResults() {
        const container = document.getElementById('resultsContainer');
        const resultsSection = document.getElementById('resultsSection');
        const loadingState = document.getElementById('loadingState');

        if (this.searchResults.length === 0) {
            resultsSection.classList.add('hidden');
            document.getElementById('noResults').classList.remove('hidden');
            return;
        }

        container.innerHTML = '';
        this.searchResults.forEach(result => {
            const resultElement = this.createResultElement(result);
            container.appendChild(resultElement);
        });

        resultsSection.classList.remove('hidden');
        loadingState.classList.add('hidden');
        document.getElementById('noResults').classList.add('hidden');
    }

    loadSettings() {
        const settings = JSON.parse(localStorage.getItem('searchSettings') || '{}');
        if (settings.resultsPerPage) {
            this.resultsPerPage = settings.resultsPerPage;
        }
    }

    suggestAlternativeLanguages() {
        const expandBtn = document.getElementById('expandLanguages');
        if (expandBtn) expandBtn.classList.remove('hidden');
    }

    sortResults() {
        const sortBy = document.getElementById('sortBy').value;
        switch (sortBy) {
            case 'date':
                this.searchResults.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
                break;
            case 'language':
                this.searchResults.sort((a, b) => a.language.localeCompare(b.language));
                break;
            case 'relevance':
            default:
                // Keep current order
                break;
        }
        this.displayResults();
    }

    loadMoreResults() {
        this.currentPage++;
        this.displayResults();
    }
}

// Initialize the search engine
const searchEngine = new GlobalMediaSearch();