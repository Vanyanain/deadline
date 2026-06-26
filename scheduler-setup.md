# Autonomous tick — Cloud Scheduler setup (Day 4)

The agent's autonomy comes from a cron hitting /tick. After deploying the backend:

```
gcloud scheduler jobs create http deadline-tick \
  --location asia-south1 \
  --schedule "*/15 * * * *" \
  --uri "https://YOUR-CLOUD-RUN-URL/tick" \
  --http-method POST \
  --oidc-service-account-email YOUR-SA@PROJECT.iam.gserviceaccount.com
```

For the live demo you can also trigger it manually with a button (POST /tick) so judges
see the observe->replan->draft cycle fire on command rather than waiting for the cron.

Note: in production /tick should iterate all active users. Day 2 version takes the
authenticated demo user, which is all the judging demo needs.
