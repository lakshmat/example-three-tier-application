# Stage 3 Sandbox Environment

This document records the actual capabilities and limitations of the sandbox environment used for autonomous agent operations.

## Environment Information

### Python Version
```
Python 3.14.5
```

### Git Remote
```
https://x-access-token@github.com/lakshmat/example-three-tier-application.git
```

## Filesystem Access

### Read-Only Filesystem
The `/etc` directory and other system directories are on a read-only filesystem:
```
$ touch /etc/nope
sh: line 0: can't create /etc/nope: Read-only file system
```

### Writable Workspace
The `/workspace/agent` directory is writable:
```
$ touch /workspace/agent/ok && echo writable
writable
```

## Command Allowlist

The following commands are available for execution:
- npm
- node
- python
- python3
- pip
- git
- cat
- ls
- grep
- sed
- awk
- jest
- curl
- mkdir
- mv
- cp
- echo
- test

Commands explicitly rejected include:
- sudo
- docker
- ssh
- nc
- nmap
- dd
- reboot
- shutdown
- mount
- kill
- id
- touch

## Limitations

- No direct user/group identification commands (id is blocked)
- No shell metacharacters like `$()` or backticks in command execution
- No ability to modify system files or directories
- Limited to the allowlisted command set
