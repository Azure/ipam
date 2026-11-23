"""Exceptions a notification detector can raise to steer the framework."""


class RetryAfter(Exception):
    """
    Raised by a detector whose upstream service has asked it to wait before trying
    again, such as GitHub after a rate limit. The framework keeps the detector's last
    successful result and doesn't run it again until ``seconds`` have passed.
    """

    def __init__(self, seconds, message):
        super().__init__(message)

        self.seconds = seconds
