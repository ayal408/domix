# הפעלה מקומית עם נטפרי

המנגנון הותאם מהדפוס הקיים ב־`ayal408/amandex`, ענף `dev` בקומיט `ec2a4c7bc671ccca092bc2abf9925a67fa65e5a7`: קובץ CA מקומי שמועבר באמצעות `EXTRA_CA_CERT` ו־Docker build secret בשם `extra_ca`. התאמת DOMIX מכסה את Node של ההתחברות, ‎.NET ואת בניית הממשק. אימות TLS נשאר פעיל.

## הפעלה ב־Windows

יש לפתוח Docker Desktop ולהריץ מתוך תיקיית DOMIX על ענף `dev`:

```powershell
git pull --ff-only origin dev
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-local.ps1
```

הסקריפט קורא תעודות NetFree תקפות שכבר מותקנות במאגרי השורש המהימנים של Windows. הוא תומך בכמה תעודות במקביל, מייצא רק את החלק הציבורי אל `.local/certs/netfree-ca.pem`, מאמת שמדובר בתעודות CA תקפות ומפעיל את Compose עם שכבת התעודות. אין צורך לבחור תעודה יחידה כשיש כמה שורשים. הוא אינו מתקין תעודה ב־Windows ואינו משנה את מאגר האמון של המחשב.

אם תעודת נטפרי אינה מותקנת, יש להתקין את התעודה הרשמית של הרשת או למסור נתיב לקובץ CA מהימן שכבר ברשותך:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-local.ps1 -ExtraCaCertPath "C:\certs\netfree-ca.pem"
```

לבדיקת הקובץ בלבד, בלי להפעיל Docker:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-local.ps1 -ExtraCaCertPath "C:\certs\netfree-ca.pem" -ValidateOnly
```

יש להכין כרגיל את `auth-server/.env` ו־`domix-server/.env` מהדוגמאות של הפרויקט, עם ההגדרות האמיתיות. הסקריפט אינו ממציא מפתחות Google, סיסמאות או כתובת אתר. `docker-compose.override.yml` קיים נשמר בשימוש. לשכבה מקומית נוספת, למשל HTTPS מקומי שכבר הוגדר:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-local.ps1 -AdditionalComposeFiles .\docker-compose.local-https.yml
```

אין שימוש ב־`down -v` ואין מחיקת מסד או תיקיית תמונות. פעולת `up -d --build` בונה ומרעננת את השירותים המקומיים; היא אינה פריסת ייצור.

## הפעלה ידנית באותו דפוס של אמנדקס

```powershell
$env:EXTRA_CA_CERT = "C:\certs\netfree-ca.pem"
$env:EXTRA_CA_SHA256 = (Get-FileHash $env:EXTRA_CA_CERT -Algorithm SHA256).Hash
docker compose -f docker-compose.yml -f docker-compose.extra-ca.yml up -d --build
```

הקובץ צריך להיות PEM ובו תעודות CA בלבד, ללא מפתח פרטי. הסקריפט בודק תקפות, Basic Constraints וקליטת כמה תעודות. קובץ שרת רגיל, PFX או PEM הכולל private key אינו קובץ CA מתאים.

## מה משתנה בכל סביבה

| שלב | המנגנון |
|---|---|
| התקנת npm בשרת האימות ובממשק | `NODE_EXTRA_CA_CERTS` מצביע על ה־build secret רק במהלך התקנת החבילות |
| אימות Google ב־Node בזמן ריצה | ה־entrypoint מגדיר `NODE_EXTRA_CA_CERTS` לפני הפעלת Node, אם תמונת Docker נבנתה עם ה־CA המקומי |
| NuGet בזמן בניית ‎.NET | תעודות ה־CA המפורשות מתווספות למאגר המערכת של שלב הבנייה |
| קריאות Gmail, Google, גאוקודינג ושירותים חיצוניים ב־‎.NET | התעודות המפורשות מתווספות למאגר של תמונת הריצה |
| טעינת כפתור Google והחלון בדפדפן | משתמשת באמון Windows/הדפדפן ובפתיחת שירותי Google ברשת נטפרי; אינה מתוקנת באמצעות תעודה בתוך Docker |

התמונה הרגילה, הנבנית ללא שכבת `extra-ca`, אינה מקבלת את התעודות המקומיות. הוסרה ההפעלה האוטומטית הישנה של `TRUST_LOCAL_DEV_CA=true` לכל בנייה. אין להעלות את תמונות הפיתוח שנבנו עם שורש נטפרי לשירות אירוח ציבורי; לבניית ייצור משתמשים ב־Dockerfiles ללא secret. הסקריפט מעביר גם גיבוב SHA256 ציבורי של bundle התעודות כדי שחידוש תעודה יבטל את מטמון שלבי האמון. בהפעלה ידנית יש לעדכן את `EXTRA_CA_SHA256` או לבצע בנייה מחדש עם `--no-cache`.

לדוגמה, לאחר החלפת תעודה:

```powershell
$env:EXTRA_CA_CERT = "C:\certs\netfree-ca.pem"
$env:EXTRA_CA_SHA256 = (Get-FileHash $env:EXTRA_CA_CERT -Algorithm SHA256).Hash
docker compose -f docker-compose.yml -f docker-compose.extra-ca.yml build --no-cache auth-server domix-server nginx-gateway
docker compose -f docker-compose.yml -f docker-compose.extra-ca.yml up -d
```

אין להגדיר `NODE_TLS_REJECT_UNAUTHORIZED=0`, אין לכבות `strict-ssl`, ואין להוסיף callback שמאשר כל תעודה ב־‎.NET.

## אבחון

- `SELF_SIGNED_CERT_IN_CHAIN`, `UNABLE_TO_VERIFY_LEAF_SIGNATURE` או שגיאת שרשרת אמון ב־Node: לבדוק שהשירות נבנה עם השכבה ושהתעודה מתאימה לרשת הנוכחית.
- `The SSL connection could not be established` ב־‎.NET: לבדוק את שגיאת השרשרת הפנימית ואת תוקף התעודה.
- חסימת נטפרי, `ERR_BLOCKED` או עמוד חסימה: זו אינה בהכרח בעיית תעודה. נדרשת בדיקת פתיחת היעד ברשת.
- `origin_mismatch` או `redirect_uri_mismatch`: לבדוק את כתובת האתר בהגדרות Google. שינוי CA אינו מתקן כתובת OAuth שגויה.
- כשל בהורדת `FROM node/...`, תמונת ‎.NET או הוראת ה־syntax לפני שלבי ה־Dockerfile: Docker Desktop/ה־builder עצמו צריך אמון בתעודת הרשת; build secret אינו מתקן שלב שקודם להרצת ה־Dockerfile.
- שגיאת תעודה בכניסה לכתובת HTTPS מקומית: זו תעודת האתר המקומי ושכבת ה־proxy, בנפרד מהאמון של השרת בחיבור יוצא ל־Google. אין להחליף עבורה את מפתחות השרת או למחוק שכבת HTTPS קיימת.

## אימות אוטומטי

`python3 scripts/tests/test-extra-ca.py` רץ ב־CI עם Docker, ‎.NET ו־OpenSSL. הוא יוצר שתי רשויות CA זמניות ושרת HTTPS מקומי. בכל אחד משירותי Node ו־‎.NET הוא בודק דחייה ללא CA, קבלה עם CA מפורש, ודחייה של שרת שנחתם ב־CA אחר גם לאחר ההוספה. הוא בונה גם את הממשק עם secret ובודק שה־CA אינו בתמונת nginx הסופית. אין שימוש בחשבון Google אמיתי או במסד ייצור.

בדיקות Windows מפעילות את הסקריפט עם bundle תקין מרובה תעודות, קלט פגום, מפתח פרטי ותעודת leaf, בלי לשנות את מאגרי Windows ובלי להפעיל Docker מקומי.

הבדיקות אינן מוכיחות שהשירותים פתוחים בנטפרי במחשב מסוים; הן מוכיחות שאימות TLS נשמר ושהתעודה המפורשת מכובדת.

מקורות: https://docs.docker.com/build/building/secrets/ ו־https://nodejs.org/docs/latest-v22.x/api/cli.html#node_extra_ca_certsfile .

## פורטים תפוסים

סקריפט ההפעלה בוחר פורטים פנויים ל־nginx, שרת האימות, שרת הנתונים ו־PostgreSQL. הוא אינו עוצר תהליך זר. אם 80 תפוס, חיפוש פורט האתר החלופי מתחיל ב־8081. שאר השירותים מחפשים החל מהפורט הבא. הפורטים בתוך Docker נשארים 80/5000/8080/5432, ולכן החיבור בין השירותים אינו תלוי בפורט שנבחר במחשב.

הבחירה נשמרת ב־`.local/ports.json` וממוחזרת בהרצה הבאה. פורט שכבר מוחזק בידי אותו שירות DOMIX אינו מזוהה בטעות כהתנגשות. אם תהליך אחר תופס את הפורט במהלך העלייה, הסקריפט מנסה לבחור שוב עד שלוש פעמים. הוא מדפיס בסיום את כתובת האתר ומעדכן את `CLIENT_APP_URL` של שרת הנתונים כדי שקישורי אימות ואיפוס סיסמה יפנו אליה. אין שינוי אוטומטי בהגדרות Google Cloud: יש לאשר שם את מקור האתר המדויק ואת כתובת החזרה של Gmail אם הפורט השתנה.

לכתובת HTTPS מקומית קבועה שכבר הוגדרה בשכבה נוספת, אפשר להעביר `-PublicUrl "https://domix.test"`. כך קישורי הדואר נשמרים בכתובת הציבורית המקומית שבחרת. אין התקנה אוטומטית של תעודת HTTPS לאתר ואין שינוי בקובץ hosts.

## אותו מבנה HTTPS כמו באמנדקס

הפקודה המקבילה היא:

```powershell
docker compose -f docker-compose.yml -f docker-compose.extra-ca.yml -f docker-compose.local-https.yml up -d --build
```

היא דורשת `EXTRA_CA_CERT` ותעודת אתר מקומית עם מפתח ב־`.certs/localhost.pem` ו־`.certs/localhost-key.pem` (או `LOCAL_HTTPS_CERT`/`LOCAL_HTTPS_KEY`). כדי להכין את ההגדרות ולבחור פורטים פנויים אוטומטית משתמשים במקום זאת בפקודה:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-local.ps1 -Https
```

אם mkcert כבר מותקן ומאגר האמון שלו כבר הוגדר כמו באמנדקס, הסקריפט יכול להנפיק תעודת localhost חסרה בלי לשנות את מאגר האמון. אם נדרשת התקנה ראשונית הוא מסביר שיש להריץ `mkcert -install`; אין התקנת שורש חדש במחשב ללא פעולה מפורשת. תעודת mkcert לאתר ותעודת נטפרי לחיבור יוצא הן שתי תעודות שונות. הסקריפט אינו מעתיק את המפתח הפרטי של רשות mkcert ואינו משנה את אמנדקס.

עם `-Https` נבחר גם פורט HTTPS פנוי; השער הפנימי ממשיך להאזין ב־443. הסקריפט מפעיל מחדש את `local-https` אחרי עדכון השירותים כדי לטעון את התעודה ואת כתובת ה־upstream המעודכנת. כשתעודת אתר מקומית הוחלפה ידנית, יש לבצע restart ל־local-https. כדי לחדש תעודה שפגה יש להנפיק אותה שוב עם mkcert לנתיבי התעודה והמפתח הללו.
