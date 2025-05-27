document.addEventListener('DOMContentLoaded', () => {
    const articleGrid = document.getElementById('article-grid');
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const exportButton = document.getElementById('export-button');
    const articleGridMessage = document.getElementById('article-grid-message');
    const categoryTabs = document.querySelectorAll('.category-tab');

    let masterArticles = []; // Stores all articles fetched (placeholder or API)
    let displayedArticles = []; // Stores articles currently shown after filtering
    let activeCategoryTab = null;

    // Define active and inactive styles for category tabs
    const activeTabClasses = ['bg-purple-600', 'text-white', 'shadow-[0_0_10px_2px_rgba(168,85,247,0.4)]'];
    const inactiveTabClasses = ['bg-gray-700', 'text-gray-300', 'hover:bg-purple-500', 'hover:text-white', 'hover:shadow-[0_0_10px_2px_rgba(168,85,247,0.4)]'];

    const displayMessage = (message, isError = false) => {
        if (articleGridMessage) {
            articleGridMessage.textContent = message;
            articleGridMessage.className = `col-span-full text-center py-4 ${isError ? 'text-red-400' : 'text-gray-400'}`;
        }
        if (articleGrid && (isError || message.startsWith("No articles found"))) { // Clear grid if error or specific "no articles" messages
             articleGrid.innerHTML = '';
        }
    };

    const renderArticles = (articlesToRender) => {
        if (!articleGrid) {
            console.error('Article grid not found!');
            return;
        }
        articleGrid.innerHTML = ''; // Clear previous articles or messages
        if (articleGridMessage) articleGridMessage.textContent = ''; // Clear message area

        if (articlesToRender.length === 0) {
            // This specific message is handled by filterArticles caller
            // displayMessage('No articles found to display.'); 
            return;
        }

        articlesToRender.forEach(article => {
            const sentimentLabel = article.sentiment ? article.sentiment.label : 'N/A';
            const sentimentScore = article.sentiment ? article.sentiment.score.toFixed(2) : 'N/A';
            let sentimentColor = 'text-yellow-400'; // Neutral default
            if (sentimentLabel === 'positive') sentimentColor = 'text-green-400';
            else if (sentimentLabel === 'negative') sentimentColor = 'text-red-400';

            const category = article.category || (article.sentiment ? article.sentiment.label : 'General');

            const articleCard = `
                <div class="bg-gray-800 rounded-lg shadow-xl border border-gray-700 overflow-hidden transition-all duration-300 hover:shadow-[0_0_15px_5px_rgba(168,85,247,0.5)] flex flex-col">
                    <a href="${article.link || '#'}" target="_blank" rel="noopener noreferrer">
                        <img class="w-full h-48 object-cover" src="${article.imageUrl || 'https://via.placeholder.com/600x300.png?text=No+Image'}" alt="${article.title || 'No Title'}">
                    </a>
                    <div class="p-6 flex flex-col flex-grow">
                        <h3 class="text-xl font-bold text-purple-300 mb-2">${article.title || 'No Title Available'}</h3>
                        <p class="text-gray-500 text-xs mb-1">Source: ${article.source || 'N/A'}</p>
                        <p class="text-gray-400 text-sm mb-3 leading-relaxed flex-grow">${article.snippet || 'No snippet available.'}</p>
                        <div class="mb-3">
                            <span class="text-xs font-semibold text-gray-500">Sentiment: </span>
                            <span class="text-sm font-bold ${sentimentColor}">
                                ${sentimentLabel} (${sentimentScore})
                            </span>
                        </div>
                        <div class="flex justify-between items-center mt-auto">
                           <span class="bg-gray-700 text-gray-300 px-3 py-1 rounded-full text-xs">${category}</span>
                           <a href="${article.link || '#'}" target="_blank" rel="noopener noreferrer" class="text-purple-400 hover:text-purple-300 text-sm font-semibold">Read More &rarr;</a>
                        </div>
                    </div>
                </div>
            `;
            articleGrid.innerHTML += articleCard;
        });
    };
    
    const setActiveTab = (tab) => {
        categoryTabs.forEach(t => {
            t.classList.remove(...activeTabClasses);
            t.classList.add(...inactiveTabClasses);
        });
        if (tab) {
            tab.classList.remove(...inactiveTabClasses);
            tab.classList.add(...activeTabClasses);
            activeCategoryTab = tab;
        } else {
            // If no tab provided (e.g. after search), find "All" and set it active
            const allTab = Array.from(categoryTabs).find(t => t.dataset.category === "All");
            if (allTab) {
                allTab.classList.remove(...inactiveTabClasses);
                allTab.classList.add(...activeTabClasses);
                activeCategoryTab = allTab;
            }
        }
    };

    const filterArticles = (category) => {
        if (category === "All") {
            displayedArticles = [...masterArticles];
        } else {
            displayedArticles = masterArticles.filter(article => 
                article.category && article.category.toLowerCase() === category.toLowerCase()
            );
        }
        
        articleGrid.innerHTML = ''; // Clear grid before rendering or showing message
        if (articleGridMessage) articleGridMessage.textContent = '';

        if (displayedArticles.length === 0) {
            displayMessage(`No articles found in the '${category}' category.`);
        } else {
            renderArticles(displayedArticles);
        }
    };

    categoryTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const category = tab.dataset.category;
            setActiveTab(tab);
            filterArticles(category);
        });
    });

    const fetchAndDisplayPlaceholderArticles = () => {
        if (sessionStorage.getItem('searchPerformed')) {
            return;
        }
        displayMessage('Loading placeholder articles...');
        fetch('/static/data/placeholder-articles.json')
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                return response.json();
            })
            .then(articles => {
                masterArticles = articles;
                setActiveTab(null); // Set "All" as active by default
                filterArticles("All"); // Display all placeholders initially
            })
            .catch(error => {
                console.error('Error fetching or processing placeholder articles:', error);
                displayMessage('Failed to load placeholder articles.', true);
                masterArticles = [];
                displayedArticles = [];
            });
    };
    
    const performSearch = () => {
        const query = searchInput.value.trim();
        if (!query) {
            displayMessage('Please enter a search query.');
            return;
        }

        displayMessage('Searching news...');
        sessionStorage.setItem('searchPerformed', 'true');

        fetch(`/api/search?q=${encodeURIComponent(query)}`)
            .then(response => {
                if (!response.ok) {
                    return response.json().then(err => { throw new Error(err.error || `HTTP error! status: ${response.status}`) });
                }
                return response.json();
            })
            .then(articles => {
                if (articles.error) { 
                    throw new Error(articles.error);
                }
                masterArticles = articles;
                setActiveTab(null); // Reset to "All" tab as active after search
                filterArticles("All"); // Display all search results
            })
            .catch(error => {
                console.error('Error fetching or processing search results:', error);
                displayMessage(`Failed to fetch news: ${error.message}`, true);
                masterArticles = [];
                displayedArticles = [];
            });
    };

    if (searchButton && searchInput) {
        searchButton.addEventListener('click', performSearch);
        searchInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                performSearch();
            }
        });
    } else {
        console.error('Search input or button not found!');
    }
    
    if (exportButton) {
        exportButton.addEventListener('click', () => {
            // Export should use displayedArticles if filtering is active, 
            // or masterArticles if "All" is selected or no filtering applied yet.
            // For simplicity, let's export what's currently displayed.
            const articlesToExport = displayedArticles.length > 0 ? displayedArticles : masterArticles;

            if (articlesToExport.length === 0) {
                alert('No articles to export. Please perform a search or load placeholder data.');
                return;
            }
            const jsonData = JSON.stringify(articlesToExport, null, 2);
            const blob = new Blob([jsonData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'sentiview_articles.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    } else {
        console.error('Export button not found!');
    }

    // Initial load
    fetchAndDisplayPlaceholderArticles();
});
