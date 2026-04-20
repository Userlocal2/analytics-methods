# Analytics Methods Demo

Небольшой проект на Node.js/JavaScript, который показывает базовые методы анализа и визуализацию данных.

## Что внутри

- Методы доходности и риска:
  - Arithmetic Mean
  - Geometric Mean
  - Variance
  - Standard Deviation
  - Downside Deviation
  - Volatility
  - Sharpe Ratio
  - Sortino Ratio
- Методы взаимосвязи активов:
  - Pearson Correlation Coefficient
  - Covariance
  - Autocorrelation
- Регрессионные методы:
  - Ordinary Least Squares (OLS)
  - Simple Linear Regression
  - Multiple Linear Regression
  - Coefficient of Determination (R²)
- Анализ временных рядов
- Пространственный (перекрестный) анализ
- Дисперсионный анализ (ANOVA)
- CAPM
- Диагностика регрессии:
  - Durbin-Watson
  - Breusch-Pagan-Godfrey
  - White test

## Запуск

```bash
cd /root/.openclaw/workspace/projects/analytics-methods
npm start
```

Открыть в браузере:

<http://localhost:3000>

Для вывода чистого JSON-анализа:

```bash
npm run analyze
```

## Структура

- `src/data.js` - демо-данные
- `src/stats.js` - статистические функции
- `src/analysis.js` - сборка результатов по методам
- `src/server.js` - простой HTTP сервер
- `public/` - фронтенд с Chart.js визуализациями

## Примечание

Это учебный и демонстрационный проект. Сейчас расчёты делаются на демо-данных, а следующая естественная доработка, загрузка CSV/Excel и библиотечное вычислительное ядро для более академичной точности.
