from flask import Flask, render_template, request, jsonify
import requests
from bs4 import BeautifulSoup
import nltk
from nltk.sentiment.vader import SentimentIntensityAnalyzer

# --- NLTK VADER setup ---
try:
    nltk.data.find('sentiment/vader_lexicon.zip')
except nltk.downloader.DownloadError:
    nltk.download('vader_lexicon')
# --- End NLTK VADER setup ---

app = Flask(__name__)
sid = SentimentIntensityAnalyzer()

# User-Agent for requests
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/search', methods=['GET'])
def api_search():
    query = request.args.get('q')
    if not query:
        return jsonify({"error": "Search query parameter 'q' is required."}), 400

    search_url = f"https://news.google.com/search?q={query}&hl=en-US&gl=US&ceid=US:en"
    
    articles_found = []

    try:
        response = requests.get(search_url, headers=HEADERS, timeout=10)
        response.raise_for_status()  # Raise an exception for HTTP errors
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Google News uses complex, often dynamic class names. 
        # This selector targets article containers. It might need adjustment if Google changes its layout.
        # Using a more general approach to find article-like structures.
        # 'c-wiz' is a common wrapper, and 'article' tag is semantic.
        
        # Attempt 1: Common structure for main articles
        article_elements = soup.find_all('article', limit=10) # Limit initial search
        
        # Fallback/Alternative selectors if the primary one fails - Google News structure is very dynamic
        if not article_elements:
             # This selector was observed in some Google News layouts for grouped articles
            article_elements = soup.select('div[jscontroller="ogToRe"] div[jscontroller="HyNfFd"] article', limit=10)


        if not article_elements:
            # A more generic selector if specific ones fail
            article_elements = soup.select('div.WuwKdb article', limit=10)


        count = 0
        for el in article_elements:
            if count >= 7: # Max 5-7 articles
                break

            title_el = el.find('h3') # Common for titles
            if not title_el:
                # Try another common pattern if h3 is not found directly under article
                title_el = el.find('a', class_='gPFEn') or el.find('a', class_='JtKRv') # Classes observed for titles
                if not title_el:
                     title_el = el.select_one('div[role="heading"][aria-level="3"]')


            title = title_el.text.strip() if title_el else "No Title Found"
            
            link_el = el.find('a', href=True)
            # Google News links are relative, need to prepend "https://news.google.com"
            # They are also often within a wrapper, so search recursively
            link_tag = el.find('a', href=True)
            raw_link = link_tag['href'] if link_tag else ""
            
            # Convert relative URLs to absolute
            if raw_link.startswith('./'):
                raw_link = "https://news.google.com" + raw_link[1:] # ./article/xyz -> /article/xyz
            
            # Snippet - often a sibling or nearby element to the title/link
            snippet_el = el.find('span', class_='xBbh9') # class for snippets in some layouts
            if not snippet_el:
                snippet_el = el.find('div', class_='GI74Re') # another potential class
            
            snippet = snippet_el.text.strip() if snippet_el else ""
            if not snippet and title_el: # Try sibling of title's parent if specific class not found
                snippet_parent = title_el.parent
                if snippet_parent:
                    next_sibling = snippet_parent.find_next_sibling()
                    if next_sibling and next_sibling.name != 'figure': # avoid image wrapper
                        snippet = next_sibling.get_text(separator=' ', strip=True)


            # Source - often within a 'div' with specific jsdata or near a time element
            source_el = el.find('div', class_='gEATFF') or el.find('div', class_='vr1PYe') # Common classes for source container
            source = source_el.text.strip() if source_el else "News Source Unknown"
            
            # Image URL - often a 'figure' element or 'img' with 'src'
            img_el = el.find('img')
            image_url = img_el['src'] if img_el and img_el.has_attr('src') else None

            # Perform Sentiment Analysis
            text_for_sentiment = title + ". " + snippet if snippet else title
            sentiment_scores = sid.polarity_scores(text_for_sentiment)
            compound_score = sentiment_scores['compound']
            
            sentiment_label = "neutral"
            if compound_score >= 0.05:
                sentiment_label = "positive"
            elif compound_score <= -0.05:
                sentiment_label = "negative"

            articles_found.append({
                "title": title,
                "source": source,
                "snippet": snippet[:200] + '...' if snippet else "No snippet available.", # Truncate long snippets
                "link": raw_link,
                "imageUrl": image_url,
                "sentiment": {
                    "score": compound_score,
                    "label": sentiment_label
                }
            })
            count += 1
            
        if not articles_found:
            return jsonify({"message": "No articles found for your query or failed to parse content.", "articles": []}), 200

        return jsonify(articles_found)

    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Failed to fetch news: {str(e)}"}), 500
    except Exception as e:
        # Generic error for parsing or other unexpected issues
        app.logger.error(f"Error in /api/search: {str(e)}") # Log the error
        return jsonify({"error": f"An unexpected error occurred: {str(e)}"}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)
