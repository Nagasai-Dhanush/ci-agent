# GitLab Webhook Test Payload

This file contains an example payload for testing the CI Agent webhook.

## Usage

```bash
curl -X POST http://localhost:3000/webhook/gitlab \
  -H "Content-Type: application/json" \
  -d @test/gitlab-webhook-payload.json
```

## Sample Payload Structure

```json
{
  "object_kind": "pipeline",
  "object_attributes": {
    "id": 430058505,
    "url": "https://gitlab.com/group/project/-/pipelines/430058505",
    "status": "failed",
    "tag": false,
    "sha": "a91957a858320c3a778c3a0cd472cf68880e8c00",
    "before_sha": "2695effb5807a22ff3d138d593f0b450fa70dd467",
    "source": "push",
    "created_at": "2024-03-27T10:05:00Z",
    "updated_at": "2024-03-27T10:15:00Z",
    "created_by_user_id": 12345
  },
  "project": {
    "id": 1234567,
    "name": "my-awesome-project",
    "description": "Test project",
    "web_url": "https://gitlab.com/group/my-awesome-project",
    "avatar_url": null,
    "git_ssh_url": "git@gitlab.com:group/my-awesome-project.git",
    "git_http_url": "https://gitlab.com/group/my-awesome-project.git",
    "namespace": "group",
    "visibility": "private",
    "path_with_namespace": "group/my-awesome-project",
    "default_branch": "main",
    "ci_config_path": ".gitlab-ci.yml"
  },
  "user": {
    "id": 12345,
    "name": "Administrator",
    "username": "root",
    "state": "active",
    "avatar_url": "https://www.gravatar.com/avatar/...",
    "web_url": "https://gitlab.com/root"
  },
  "commit": {
    "id": "a91957a858320c3a778c3a0cd472cf68880e8c00",
    "message": "Add feature X",
    "title": "Add feature X",
    "timestamp": "2024-03-27T08:05:00Z",
    "url": "https://gitlab.com/group/my-awesome-project/-/commit/a91957a858320c3a778c3a0cd472cf68880e8c00",
    "author": {
      "name": "Administrator",
      "email": "admin@example.com"
    }
  },
  "builds": [
    {
      "id": 987654321,
      "stage": "test",
      "name": "jest-tests",
      "status": "failed",
      "created_at": "2024-03-27T10:05:00Z",
      "started_at": "2024-03-27T10:06:00Z",
      "finished_at": "2024-03-27T10:13:00Z",
      "duration": 420.0,
      "queued_duration": 1.0,
      "failure_reason": "script_failure",
      "when": "on_success",
      "manual": false,
      "allow_failure": false,
      "user": {
        "id": 12345,
        "name": "Administrator",
        "username": "root"
      },
      "runner": {
        "id": 1,
        "description": "shared-runner-1",
        "runner_version": null,
        "tag_list": ["linux", "docker"]
      },
      "artifacts_file": {
        "filename": "artifacts.zip",
        "size": 1024000
      },
      "environment": null,
      "coverage": null,
      "commit": {
        "id": "a91957a858320c3a778c3a0cd472cf68880e8c00",
        "short_id": "a91957a8",
        "created_at": "2024-03-27T08:05:00Z",
        "parent_ids": []
      },
      "source": "push"
    }
  ]
}
```

## Simulating Different Failure Types

### Flaky Test Failure
Modify log output to contain: `AssertionError` or `Timeout waiting`

### Dependency Issue
Modify log output to contain: `npm ERR!` or `ModuleNotFoundError`

### Environment Issue
Modify log output to contain: `ECONNRESET` or `ENOTFOUND`

### Rate Limit
Modify log output to contain: `429` or `Too Many Requests`

## Notes

- Replace project/build IDs with actual values from your GitLab instance
- The agent will fetch actual logs from GitLab using the build ID
- Ensure GitLab token is configured for log retrieval
- Test endpoint should be accessible from GitLab webhook runner
